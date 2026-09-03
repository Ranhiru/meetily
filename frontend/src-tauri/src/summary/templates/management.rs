use super::types::{Template, TemplateSection};
use super::{defaults, loader::validate_and_parse_template};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::io::Write;
use std::path::PathBuf;
use tempfile::NamedTempFile;
use uuid::Uuid;

pub const STANDARD_MEETING_ID: &str = "standard_meeting";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TemplateOrigin {
    BuiltIn,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDescriptor {
    pub id: String,
    pub name: String,
    pub description: String,
    pub origin: TemplateOrigin,
    pub is_global_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub origin: TemplateOrigin,
    pub sections: Vec<TemplateSection>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveTemplate {
    pub id: String,
    pub name: String,
    pub meeting_override_id: Option<String>,
    pub inherited: bool,
    pub recovery_notice: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GenerationTemplate {
    pub id: String,
    pub recovery_notice: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteImpact {
    pub referenced_meetings: i64,
    pub is_global_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationOutcome {
    pub migrated_templates: Vec<ManagedTemplate>,
}

impl ManagedTemplate {
    pub fn into_template(self) -> Template {
        Template {
            name: self.name,
            description: self.description,
            sections: self.sections,
        }
    }
}

#[derive(Clone)]
pub struct TemplateManagementService {
    custom_templates_dir: PathBuf,
    pool: SqlitePool,
}

impl TemplateManagementService {
    pub fn new(custom_templates_dir: PathBuf, pool: SqlitePool) -> Self {
        Self {
            custom_templates_dir,
            pool,
        }
    }

    pub async fn catalog(&self) -> Result<Vec<TemplateDescriptor>, String> {
        let global_default = self.stored_global_default().await;
        let mut catalog = Vec::new();

        for (id, json) in defaults::get_builtin_templates() {
            let template = validate_and_parse_template(json)?;
            catalog.push(TemplateDescriptor {
                id: id.to_string(),
                name: template.name,
                description: template.description,
                origin: TemplateOrigin::BuiltIn,
                is_global_default: id == global_default,
            });
        }

        if self.custom_templates_dir.exists() {
            let entries = std::fs::read_dir(&self.custom_templates_dir)
                .map_err(|error| format!("Failed to read custom templates: {error}"))?;

            for entry in entries {
                let entry =
                    entry.map_err(|error| format!("Failed to read custom template: {error}"))?;
                let path = entry.path();
                if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
                    continue;
                }
                let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else {
                    continue;
                };
                if defaults::get_builtin_template(id).is_some() || !valid_id(id) {
                    continue;
                }

                let json = std::fs::read_to_string(&path)
                    .map_err(|error| format!("Failed to read custom template '{id}': {error}"))?;
                let template = validate_and_parse_template(&json)?;
                catalog.push(TemplateDescriptor {
                    id: id.to_string(),
                    name: template.name,
                    description: template.description,
                    origin: TemplateOrigin::Custom,
                    is_global_default: id == global_default,
                });
            }
        }

        catalog.sort_by(|left, right| {
            left.origin
                .sort_order()
                .cmp(&right.origin.sort_order())
                .then_with(|| normalized_name(&left.name).cmp(&normalized_name(&right.name)))
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(catalog)
    }

    pub async fn get(&self, id: &str) -> Result<ManagedTemplate, String> {
        if !valid_id(id) {
            return Err("Template ID contains invalid characters".to_string());
        }

        let (template, origin) = if let Some(json) = defaults::get_builtin_template(id) {
            (validate_and_parse_template(json)?, TemplateOrigin::BuiltIn)
        } else {
            let path = self.custom_template_path(id)?;
            let json = std::fs::read_to_string(&path)
                .map_err(|_| format!("Template '{id}' was not found"))?;
            (validate_and_parse_template(&json)?, TemplateOrigin::Custom)
        };

        Ok(ManagedTemplate {
            id: id.to_string(),
            name: template.name,
            description: template.description,
            origin,
            sections: template.sections,
        })
    }

    pub async fn create(&self, template: Template) -> Result<ManagedTemplate, String> {
        let template = normalize_template(template);
        template.validate()?;
        self.ensure_unique_name(&template.name, None).await?;

        let id = format!("custom_{}", Uuid::new_v4().simple());
        self.persist(&id, &template)?;
        self.get(&id).await
    }

    pub async fn update(&self, id: &str, template: Template) -> Result<ManagedTemplate, String> {
        if defaults::get_builtin_template(id).is_some() {
            return Err("Built-in templates are read-only".to_string());
        }
        let existing = self.get(id).await?;
        if existing.origin != TemplateOrigin::Custom {
            return Err("Only custom templates can be updated".to_string());
        }

        let template = normalize_template(template);
        template.validate()?;
        self.ensure_unique_name(&template.name, Some(id)).await?;
        self.persist(id, &template)?;
        self.get(id).await
    }

    pub async fn duplicate(&self, id: &str) -> Result<ManagedTemplate, String> {
        let source = self.get(id).await?;
        let existing_names: Vec<String> = self
            .catalog()
            .await?
            .into_iter()
            .map(|template| normalized_name(&template.name))
            .collect();
        let base = format!("{} Copy", source.name);
        let mut copy_name = base.clone();
        let mut suffix = 2;
        while existing_names.contains(&normalized_name(&copy_name)) {
            copy_name = format!("{base} {suffix}");
            suffix += 1;
        }

        self.create(Template {
            name: copy_name,
            description: source.description,
            sections: source.sections,
        })
        .await
    }

    pub async fn set_global_default(&self, id: &str) -> Result<TemplateDescriptor, String> {
        self.get(id).await?;
        sqlx::query(
            "INSERT INTO template_preferences (id, global_default_id)
             VALUES (1, ?)
             ON CONFLICT(id) DO UPDATE SET global_default_id = excluded.global_default_id",
        )
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|error| format!("Failed to save the global template default: {error}"))?;

        self.catalog()
            .await?
            .into_iter()
            .find(|template| template.id == id)
            .ok_or_else(|| format!("Template '{id}' was not found"))
    }

    pub async fn set_meeting_override(
        &self,
        meeting_id: &str,
        template_id: Option<&str>,
    ) -> Result<EffectiveTemplate, String> {
        if let Some(id) = template_id {
            self.get(id).await?;
        }
        let result = sqlx::query("UPDATE meetings SET template_override_id = ? WHERE id = ?")
            .bind(template_id)
            .bind(meeting_id)
            .execute(&self.pool)
            .await
            .map_err(|error| format!("Failed to save the meeting template: {error}"))?;
        if result.rows_affected() == 0 {
            return Err(format!("Meeting '{meeting_id}' was not found"));
        }
        self.resolve_effective(Some(meeting_id)).await
    }

    pub async fn resolve_effective(
        &self,
        meeting_id: Option<&str>,
    ) -> Result<EffectiveTemplate, String> {
        let mut recovery_notices = Vec::new();
        let mut global_default = self.stored_global_default().await;
        if self.get(&global_default).await.is_err() {
            let missing_default = global_default.clone();
            global_default = STANDARD_MEETING_ID.to_string();
            self.set_global_default(STANDARD_MEETING_ID).await?;
            log::warn!(
                "Recovered template global default: '{missing_default}' is unavailable; reset to '{STANDARD_MEETING_ID}'"
            );
            recovery_notices.push(
                "The saved global template was unavailable, so Standard Meeting was restored."
                    .to_string(),
            );
        }

        let mut meeting_override_id = if let Some(meeting_id) = meeting_id {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT template_override_id FROM meetings WHERE id = ?",
            )
            .bind(meeting_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|error| format!("Failed to load the meeting template: {error}"))?
            .flatten()
        } else {
            None
        };

        if let (Some(meeting_id), Some(override_id)) = (meeting_id, meeting_override_id.as_deref())
        {
            if self.get(override_id).await.is_err() {
                sqlx::query("UPDATE meetings SET template_override_id = NULL WHERE id = ?")
                    .bind(meeting_id)
                    .execute(&self.pool)
                    .await
                    .map_err(|error| format!("Failed to recover the meeting template: {error}"))?;
                log::warn!(
                    "Recovered meeting '{meeting_id}' template override: '{override_id}' is unavailable; cleared to follow the global default"
                );
                meeting_override_id = None;
                recovery_notices.push(
                    "The meeting template was unavailable, so this meeting now uses the global default."
                        .to_string(),
                );
            }
        }

        let effective_id = meeting_override_id
            .clone()
            .unwrap_or_else(|| global_default.clone());
        let template = self.get(&effective_id).await?;
        Ok(EffectiveTemplate {
            id: effective_id,
            name: template.name,
            inherited: meeting_override_id.is_none(),
            meeting_override_id,
            recovery_notice: (!recovery_notices.is_empty()).then(|| recovery_notices.join(" ")),
        })
    }

    pub async fn resolve_for_generation(
        &self,
        meeting_id: &str,
        requested_template_id: Option<&str>,
    ) -> Result<GenerationTemplate, String> {
        let effective = self.resolve_effective(Some(meeting_id)).await?;
        let Some(requested_template_id) = requested_template_id else {
            return Ok(GenerationTemplate {
                id: effective.id,
                recovery_notice: effective.recovery_notice,
            });
        };

        self.get(requested_template_id).await?;
        Ok(GenerationTemplate {
            id: requested_template_id.to_string(),
            recovery_notice: effective.recovery_notice,
        })
    }

    pub async fn deletion_impact(&self, id: &str) -> Result<DeleteImpact, String> {
        let template = self.get(id).await?;
        if template.origin != TemplateOrigin::Custom {
            return Err("Built-in templates cannot be deleted".to_string());
        }
        let referenced_meetings = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM meetings WHERE template_override_id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| format!("Failed to count template references: {error}"))?;
        Ok(DeleteImpact {
            referenced_meetings,
            is_global_default: self.stored_global_default().await == id,
        })
    }

    pub async fn delete(&self, id: &str) -> Result<DeleteImpact, String> {
        let impact = self.deletion_impact(id).await?;
        let path = self.custom_template_path(id)?;
        let tombstone = self
            .custom_templates_dir
            .join(format!(".{id}.{}.deleting", Uuid::new_v4().simple()));
        std::fs::rename(&path, &tombstone)
            .map_err(|error| format!("Failed to prepare template deletion: {error}"))?;

        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|error| format!("Failed to begin template deletion: {error}"))?;
        let database_result: Result<(), sqlx::Error> = async {
            sqlx::query(
                "UPDATE meetings SET template_override_id = NULL WHERE template_override_id = ?",
            )
            .bind(id)
            .execute(&mut *transaction)
            .await?;
            sqlx::query(
                "UPDATE template_preferences
                 SET global_default_id = ?
                 WHERE id = 1 AND global_default_id = ?",
            )
            .bind(STANDARD_MEETING_ID)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
            Ok(())
        }
        .await;

        if let Err(error) = database_result {
            let _ = transaction.rollback().await;
            let _ = std::fs::rename(&tombstone, &path);
            return Err(format!("Failed to clean up template references: {error}"));
        }
        if let Err(error) = transaction.commit().await {
            let _ = std::fs::rename(&tombstone, &path);
            return Err(format!("Failed to commit template deletion: {error}"));
        }

        std::fs::remove_file(&tombstone)
            .map_err(|error| format!("Template was deleted but cleanup failed: {error}"))?;
        Ok(impact)
    }

    pub async fn migrate_legacy_collisions(&self) -> Result<MigrationOutcome, String> {
        let mut migrated_templates = Vec::new();
        for builtin_id in defaults::list_builtin_template_ids() {
            let legacy_path = self.custom_template_path(builtin_id)?;
            if !legacy_path.exists() {
                continue;
            }
            let json = std::fs::read_to_string(&legacy_path).map_err(|error| {
                format!("Failed to read legacy template '{builtin_id}': {error}")
            })?;
            let mut legacy = validate_and_parse_template(&json)?;
            legacy.name = self.unique_name(&legacy.name).await?;
            let migrated = self.create(legacy).await?;

            let mut transaction = match self.pool.begin().await {
                Ok(transaction) => transaction,
                Err(error) => {
                    let _ = std::fs::remove_file(self.custom_template_path(&migrated.id)?);
                    return Err(format!(
                        "Failed to begin legacy template migration: {error}"
                    ));
                }
            };
            let rewire_result: Result<(), sqlx::Error> = async {
                sqlx::query(
                    "UPDATE template_preferences SET global_default_id = ?
                     WHERE id = 1 AND global_default_id = ?",
                )
                .bind(&migrated.id)
                .bind(builtin_id)
                .execute(&mut *transaction)
                .await?;
                sqlx::query(
                    "UPDATE meetings SET template_override_id = ? WHERE template_override_id = ?",
                )
                .bind(&migrated.id)
                .bind(builtin_id)
                .execute(&mut *transaction)
                .await?;
                Ok(())
            }
            .await;
            if let Err(error) = rewire_result {
                let _ = transaction.rollback().await;
                let _ = std::fs::remove_file(self.custom_template_path(&migrated.id)?);
                return Err(format!(
                    "Failed to migrate legacy template references: {error}"
                ));
            }
            if let Err(error) = transaction.commit().await {
                return Err(format!(
                    "Failed to commit legacy template migration: {error}"
                ));
            }
            std::fs::remove_file(&legacy_path)
                .map_err(|error| format!("Failed to finish legacy template migration: {error}"))?;
            log::info!(
                "Migrated legacy template '{builtin_id}' to independent custom template '{}' ('{}')",
                migrated.id,
                migrated.name
            );
            migrated_templates.push(migrated);
        }
        Ok(MigrationOutcome { migrated_templates })
    }

    fn custom_template_path(&self, id: &str) -> Result<PathBuf, String> {
        if !valid_id(id) {
            return Err("Template ID contains invalid characters".to_string());
        }
        Ok(self.custom_templates_dir.join(format!("{id}.json")))
    }

    fn persist(&self, id: &str, template: &Template) -> Result<(), String> {
        let path = self.custom_template_path(id)?;
        std::fs::create_dir_all(&self.custom_templates_dir)
            .map_err(|error| format!("Failed to create the template directory: {error}"))?;
        let json = serde_json::to_vec_pretty(template)
            .map_err(|error| format!("Failed to serialize template: {error}"))?;
        let mut temporary = NamedTempFile::new_in(&self.custom_templates_dir)
            .map_err(|error| format!("Failed to prepare template save: {error}"))?;
        temporary
            .write_all(&json)
            .and_then(|_| temporary.as_file().sync_all())
            .map_err(|error| format!("Failed to write template: {error}"))?;
        temporary
            .persist(&path)
            .map_err(|error| format!("Failed to save template: {}", error.error))?;
        Ok(())
    }

    async fn ensure_unique_name(&self, name: &str, except_id: Option<&str>) -> Result<(), String> {
        let normalized = normalized_name(name);
        if self.catalog().await?.into_iter().any(|template| {
            Some(template.id.as_str()) != except_id && normalized_name(&template.name) == normalized
        }) {
            return Err("Template names must be unique".to_string());
        }
        Ok(())
    }

    async fn unique_name(&self, requested: &str) -> Result<String, String> {
        let names: Vec<String> = self
            .catalog()
            .await?
            .into_iter()
            .map(|template| normalized_name(&template.name))
            .collect();
        if !names.contains(&normalized_name(requested)) {
            return Ok(requested.to_string());
        }
        let base = format!("{requested} Copy");
        let mut candidate = base.clone();
        let mut suffix = 2;
        while names.contains(&normalized_name(&candidate)) {
            candidate = format!("{base} {suffix}");
            suffix += 1;
        }
        Ok(candidate)
    }

    async fn stored_global_default(&self) -> String {
        sqlx::query_scalar::<_, String>(
            "SELECT global_default_id FROM template_preferences WHERE id = 1",
        )
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| STANDARD_MEETING_ID.to_string())
    }
}

impl TemplateOrigin {
    fn sort_order(self) -> u8 {
        match self {
            Self::BuiltIn => 0,
            Self::Custom => 1,
        }
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn normalized_name(name: &str) -> String {
    name.trim().to_lowercase()
}

fn normalize_template(mut template: Template) -> Template {
    template.name = template.name.trim().to_string();
    template.description = template.description.trim().to_string();
    for section in &mut template.sections {
        section.title = section.title.trim().to_string();
        section.instruction = section.instruction.trim().to_string();
        section.format = section.format.trim().to_lowercase();
        section.item_format = section
            .item_format
            .take()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
    }
    template
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    async fn service() -> (TempDir, TemplateManagementService) {
        let temp = tempfile::tempdir().unwrap();
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        // Run the real migration set so tests fail if the schema drifts.
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        let service = TemplateManagementService::new(temp.path().to_path_buf(), pool);
        (temp, service)
    }

    #[tokio::test]
    async fn catalog_exposes_complete_sorted_builtin_and_custom_templates() {
        let (temp, service) = service().await;
        std::fs::write(
            temp.path().join("custom_notes.json"),
            r#"{
                "name": "A Custom Notes",
                "description": "Custom description",
                "sections": [{
                    "title": "Outcome",
                    "instruction": "Capture the outcome",
                    "format": "paragraph"
                }]
            }"#,
        )
        .unwrap();

        let catalog = service.catalog().await.unwrap();
        let custom = catalog
            .iter()
            .find(|template| template.id == "custom_notes")
            .unwrap();

        assert_eq!(custom.name, "A Custom Notes");
        assert_eq!(custom.origin, TemplateOrigin::Custom);
        assert!(catalog
            .iter()
            .any(|template| template.id == STANDARD_MEETING_ID
                && template.origin == TemplateOrigin::BuiltIn
                && template.is_global_default));

        let details = service.get("custom_notes").await.unwrap();
        assert_eq!(details.sections[0].title, "Outcome");
        assert_eq!(details.sections[0].instruction, "Capture the outcome");
    }

    fn valid_template(name: &str) -> Template {
        Template {
            name: name.to_string(),
            description: "A reusable workflow".to_string(),
            sections: vec![TemplateSection {
                title: "Outcome".to_string(),
                instruction: "Capture the outcome".to_string(),
                format: "paragraph".to_string(),
                item_format: None,
            }],
        }
    }

    #[tokio::test]
    async fn create_and_update_preserve_identity_and_survive_reconstruction() {
        let (temp, service) = service().await;

        let created = service
            .create(valid_template("Product Review"))
            .await
            .unwrap();
        assert_eq!(created.origin, TemplateOrigin::Custom);
        assert!(created.id.starts_with("custom_"));

        let mut edited = valid_template("Renamed Product Review");
        edited.sections[0].format = "list".to_string();
        let updated = service.update(&created.id, edited).await.unwrap();
        assert_eq!(updated.id, created.id);

        let reconstructed = TemplateManagementService::new(
            temp.path().to_path_buf(),
            SqlitePool::connect("sqlite::memory:").await.unwrap(),
        );
        let reloaded = reconstructed.get(&created.id).await.unwrap();
        assert_eq!(reloaded.name, "Renamed Product Review");
        assert_eq!(reloaded.sections[0].format, "list");
    }

    #[tokio::test]
    async fn durable_global_default_and_meeting_override_resolve_with_correct_precedence() {
        let (_temp, service) = service().await;
        sqlx::query("INSERT INTO meetings (id, title, created_at, updated_at) VALUES ('meeting-1', 'Meeting 1', '2026-01-01', '2026-01-01'), ('meeting-2', 'Meeting 2', '2026-01-01', '2026-01-01')")
            .execute(&service.pool)
            .await
            .unwrap();
        let custom = service.create(valid_template("Workshop")).await.unwrap();

        service.set_global_default("daily_standup").await.unwrap();
        let inherited = service.resolve_effective(Some("meeting-1")).await.unwrap();
        assert_eq!(inherited.id, "daily_standup");
        assert!(inherited.inherited);

        service
            .set_meeting_override("meeting-1", Some(&custom.id))
            .await
            .unwrap();
        service
            .set_global_default("standard_meeting")
            .await
            .unwrap();

        let overridden = service.resolve_effective(Some("meeting-1")).await.unwrap();
        assert_eq!(overridden.id, custom.id);
        assert!(!overridden.inherited);
        assert_eq!(
            service
                .resolve_effective(Some("meeting-2"))
                .await
                .unwrap()
                .id,
            "standard_meeting"
        );

        let cleared = service
            .set_meeting_override("meeting-1", None)
            .await
            .unwrap();
        assert_eq!(cleared.id, "standard_meeting");
        assert!(cleared.inherited);
    }

    #[tokio::test]
    async fn deletion_reports_impact_and_clears_defaults_and_overrides() {
        let (_temp, service) = service().await;
        sqlx::query("INSERT INTO meetings (id, title, created_at, updated_at) VALUES ('meeting-1', 'Meeting 1', '2026-01-01', '2026-01-01'), ('meeting-2', 'Meeting 2', '2026-01-01', '2026-01-01')")
            .execute(&service.pool)
            .await
            .unwrap();
        let custom = service.create(valid_template("Disposable")).await.unwrap();
        service.set_global_default(&custom.id).await.unwrap();
        service
            .set_meeting_override("meeting-1", Some(&custom.id))
            .await
            .unwrap();

        let impact = service.deletion_impact(&custom.id).await.unwrap();
        assert_eq!(impact.referenced_meetings, 1);
        assert!(impact.is_global_default);

        assert_eq!(service.delete(&custom.id).await.unwrap(), impact);
        assert!(service.get(&custom.id).await.is_err());
        assert_eq!(
            service
                .resolve_effective(Some("meeting-1"))
                .await
                .unwrap()
                .id,
            STANDARD_MEETING_ID
        );
        assert_eq!(service.stored_global_default().await, STANDARD_MEETING_ID);
    }

    #[tokio::test]
    async fn legacy_builtin_shadow_is_migrated_once_without_losing_content() {
        let (temp, service) = service().await;
        let mut legacy = valid_template("Legacy Standard");
        legacy.sections[0].item_format = Some("| Result |".to_string());
        std::fs::write(
            temp.path().join("standard_meeting.json"),
            serde_json::to_vec_pretty(&legacy).unwrap(),
        )
        .unwrap();

        let first = service.migrate_legacy_collisions().await.unwrap();
        assert_eq!(first.migrated_templates.len(), 1);
        let migrated = &first.migrated_templates[0];
        assert_ne!(migrated.id, STANDARD_MEETING_ID);
        assert_eq!(migrated.name, "Legacy Standard");
        assert_eq!(
            migrated.sections[0].item_format.as_deref(),
            Some("| Result |")
        );
        assert_eq!(
            service.get(STANDARD_MEETING_ID).await.unwrap().origin,
            TemplateOrigin::BuiltIn
        );

        let second = service.migrate_legacy_collisions().await.unwrap();
        assert!(second.migrated_templates.is_empty());
    }

    #[tokio::test]
    async fn validation_protects_names_sections_builtins_and_storage_paths() {
        let (_temp, service) = service().await;
        service.create(valid_template("Unique Name")).await.unwrap();

        assert!(service
            .create(valid_template("  unique name  "))
            .await
            .unwrap_err()
            .contains("unique"));

        let mut duplicate_sections = valid_template("Another Name");
        duplicate_sections.sections.push(TemplateSection {
            title: " outcome ".to_string(),
            instruction: "Duplicate title".to_string(),
            format: "string".to_string(),
            item_format: None,
        });
        assert!(service.create(duplicate_sections).await.is_err());
        assert!(service
            .update(STANDARD_MEETING_ID, valid_template("Changed Built-in"))
            .await
            .is_err());
        assert!(service.get("../outside").await.is_err());
    }

    #[tokio::test]
    async fn duplicate_is_an_independent_complete_custom_snapshot() {
        let (_temp, service) = service().await;

        let first = service.duplicate("daily_standup").await.unwrap();
        let second = service.duplicate("daily_standup").await.unwrap();

        assert_ne!(first.id, second.id);
        assert_eq!(first.name, "Daily Standup Copy");
        assert_eq!(second.name, "Daily Standup Copy 2");
        assert_eq!(first.origin, TemplateOrigin::Custom);
        assert_eq!(
            first.sections[2].item_format.as_deref(),
            Some("| **Owner** | **Completed Work** |\n| --- | --- |")
        );
    }

    #[tokio::test]
    async fn dangling_references_are_repaired_before_generation() {
        let (_temp, service) = service().await;
        sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at, template_override_id)
             VALUES ('meeting-1', 'Meeting 1', '2026-01-01', '2026-01-01', 'missing')",
        )
        .execute(&service.pool)
        .await
        .unwrap();
        sqlx::query(
            "UPDATE template_preferences SET global_default_id = 'also_missing' WHERE id = 1",
        )
        .execute(&service.pool)
        .await
        .unwrap();

        let resolved = service.resolve_effective(Some("meeting-1")).await.unwrap();

        assert_eq!(resolved.id, STANDARD_MEETING_ID);
        assert!(resolved.inherited);
        assert!(resolved.recovery_notice.is_some());
        assert_eq!(service.stored_global_default().await, STANDARD_MEETING_ID);
        let stored_override = sqlx::query_scalar::<_, Option<String>>(
            "SELECT template_override_id FROM meetings WHERE id = 'meeting-1'",
        )
        .fetch_one(&service.pool)
        .await
        .unwrap();
        assert!(stored_override.is_none());
    }

    #[tokio::test]
    async fn generation_honors_a_requested_template_over_a_stale_override() {
        let (_temp, service) = service().await;
        sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at, template_override_id)
             VALUES ('meeting-1', 'Meeting 1', '2026-01-01', '2026-01-01', 'daily_standup')",
        )
        .execute(&service.pool)
        .await
        .unwrap();

        let selected = service
            .resolve_for_generation("meeting-1", Some(STANDARD_MEETING_ID))
            .await
            .unwrap();

        assert_eq!(selected.id, STANDARD_MEETING_ID);
    }

    #[tokio::test]
    async fn migration_rolls_back_references_when_meeting_rewire_fails() {
        let (temp, service) = service().await;
        std::fs::write(
            temp.path().join("standard_meeting.json"),
            serde_json::to_vec_pretty(&valid_template("Legacy Standard")).unwrap(),
        )
        .unwrap();
        sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at, template_override_id)
             VALUES ('meeting-1', 'Meeting 1', '2026-01-01', '2026-01-01', 'standard_meeting')",
        )
        .execute(&service.pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TRIGGER reject_legacy_rewire
             BEFORE UPDATE OF template_override_id ON meetings
             WHEN OLD.template_override_id = 'standard_meeting'
             BEGIN SELECT RAISE(ABORT, 'meeting rewire rejected'); END",
        )
        .execute(&service.pool)
        .await
        .unwrap();

        assert!(service.migrate_legacy_collisions().await.is_err());
        assert_eq!(service.stored_global_default().await, STANDARD_MEETING_ID);
        assert!(temp.path().join("standard_meeting.json").exists());
        assert!(std::fs::read_dir(temp.path()).unwrap().all(|entry| !entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with("custom_")));
    }
}
