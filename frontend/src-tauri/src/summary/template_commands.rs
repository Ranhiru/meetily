use crate::state::AppState;
use crate::summary::templates::management::{
    DeleteImpact, EffectiveTemplate, ManagedTemplate, MigrationOutcome, TemplateDescriptor,
    TemplateManagementService,
};
use crate::summary::templates::{self, Template};
use tauri::State;

fn service(state: &AppState) -> Result<TemplateManagementService, String> {
    let custom_templates_dir = templates::get_custom_templates_dir()
        .ok_or_else(|| "The local template directory is unavailable".to_string())?;
    Ok(TemplateManagementService::new(
        custom_templates_dir,
        state.db_manager.pool().clone(),
    ))
}

#[tauri::command]
pub async fn api_list_templates(
    state: State<'_, AppState>,
) -> Result<Vec<TemplateDescriptor>, String> {
    service(&state)?.catalog().await
}

#[tauri::command]
pub async fn api_get_template_details(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<ManagedTemplate, String> {
    service(&state)?.get(&template_id).await
}

#[tauri::command]
pub async fn api_create_template(
    state: State<'_, AppState>,
    template: Template,
) -> Result<ManagedTemplate, String> {
    service(&state)?.create(template).await
}

#[tauri::command]
pub async fn api_update_template(
    state: State<'_, AppState>,
    template_id: String,
    template: Template,
) -> Result<ManagedTemplate, String> {
    service(&state)?.update(&template_id, template).await
}

#[tauri::command]
pub async fn api_duplicate_template(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<ManagedTemplate, String> {
    service(&state)?.duplicate(&template_id).await
}

#[tauri::command]
pub async fn api_set_global_template_default(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<TemplateDescriptor, String> {
    service(&state)?.set_global_default(&template_id).await
}

#[tauri::command]
pub async fn api_get_effective_template(
    state: State<'_, AppState>,
    meeting_id: Option<String>,
) -> Result<EffectiveTemplate, String> {
    service(&state)?
        .resolve_effective(meeting_id.as_deref())
        .await
}

#[tauri::command]
pub async fn api_set_meeting_template_override(
    state: State<'_, AppState>,
    meeting_id: String,
    template_id: Option<String>,
) -> Result<EffectiveTemplate, String> {
    service(&state)?
        .set_meeting_override(&meeting_id, template_id.as_deref())
        .await
}

#[tauri::command]
pub async fn api_get_template_deletion_impact(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<DeleteImpact, String> {
    service(&state)?.deletion_impact(&template_id).await
}

#[tauri::command]
pub async fn api_delete_template(
    state: State<'_, AppState>,
    template_id: String,
) -> Result<DeleteImpact, String> {
    service(&state)?.delete(&template_id).await
}

#[tauri::command]
pub async fn api_migrate_legacy_templates(
    state: State<'_, AppState>,
) -> Result<MigrationOutcome, String> {
    service(&state)?.migrate_legacy_collisions().await
}

#[tauri::command]
pub async fn api_validate_template(
    _state: State<'_, AppState>,
    template_json: String,
) -> Result<String, String> {
    templates::validate_and_parse_template(&template_json).map(|template| template.name)
}
