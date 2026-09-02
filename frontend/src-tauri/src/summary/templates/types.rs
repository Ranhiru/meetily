use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Represents a single section in a meeting template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateSection {
    /// Section title (e.g., "Summary", "Action Items")
    pub title: String,

    /// Instruction for the LLM on what to extract/include
    pub instruction: String,

    /// Format type: "paragraph", "list", or "string"
    pub format: String,

    /// Optional markdown formatting hint for list items (e.g., table structure)
    #[serde(
        default,
        alias = "example_item_format",
        skip_serializing_if = "Option::is_none"
    )]
    pub item_format: Option<String>,
}

/// Represents a complete meeting template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    /// Template display name
    pub name: String,

    /// Brief description of the template's purpose
    pub description: String,

    /// List of sections in the template
    pub sections: Vec<TemplateSection>,
}

impl Template {
    /// Validates the template structure
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Template name cannot be empty".to_string());
        }

        if self.description.trim().is_empty() {
            return Err("Template description cannot be empty".to_string());
        }

        if self.sections.is_empty() {
            return Err("Template must have at least one section".to_string());
        }

        let mut section_titles = HashSet::new();
        for (i, section) in self.sections.iter().enumerate() {
            if section.title.trim().is_empty() {
                return Err(format!("Section {} has empty title", i));
            }

            if section.instruction.trim().is_empty() {
                return Err(format!("Section '{}' has empty instruction", section.title));
            }

            match section.format.as_str() {
                "paragraph" | "list" | "string" => {},
                other => return Err(format!(
                    "Section '{}' has invalid format '{}'. Must be 'paragraph', 'list', or 'string'",
                    section.title, other
                )),
            }

            if !section_titles.insert(section.title.trim().to_lowercase()) {
                return Err(format!("Section title '{}' must be unique", section.title));
            }
        }

        Ok(())
    }

    /// Generates a clean markdown template structure
    pub fn to_markdown_structure(&self) -> String {
        let mut markdown = String::from("# <Add Title here>\n\n");

        for section in &self.sections {
            markdown.push_str(&format!("**{}**\n\n", section.title));
        }

        markdown
    }

    /// Generates section-specific instructions for the LLM
    pub fn to_section_instructions(&self) -> String {
        let mut instructions = String::from(
            "- **For the main title (`# [AI-Generated Title]`):** Analyze the entire transcript and create a concise, descriptive title for the meeting.\n"
        );

        for section in &self.sections {
            instructions.push_str(&format!(
                "- **For the '{}' section:** {}.\n",
                section.title, section.instruction
            ));

            let style_instruction = match section.format.as_str() {
                "paragraph" => "Write cohesive prose.",
                "list" => "Use list-oriented content.",
                "string" => "Return one concise value.",
                _ => "",
            };
            if !style_instruction.is_empty() {
                instructions.push_str(&format!("  - {style_instruction}\n"));
            }

            if let Some(format) = section.item_format.as_ref() {
                instructions.push_str(&format!(
                    "  - Items in this section should follow the format: `{}`.\n",
                    format
                ));
            }
        }

        instructions
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_template() {
        let template = Template {
            name: "Test Template".to_string(),
            description: "A test template".to_string(),
            sections: vec![TemplateSection {
                title: "Summary".to_string(),
                instruction: "Provide a summary".to_string(),
                format: "paragraph".to_string(),
                item_format: None,
            }],
        };

        assert!(template.validate().is_ok());
    }

    #[test]
    fn test_validate_empty_name() {
        let template = Template {
            name: "".to_string(),
            description: "A test template".to_string(),
            sections: vec![],
        };

        assert!(template.validate().is_err());
    }

    #[test]
    fn test_validate_invalid_format() {
        let template = Template {
            name: "Test".to_string(),
            description: "Test".to_string(),
            sections: vec![TemplateSection {
                title: "Test".to_string(),
                instruction: "Test".to_string(),
                format: "invalid".to_string(),
                item_format: None,
            }],
        };

        assert!(template.validate().is_err());
    }

    #[test]
    fn output_styles_and_legacy_patterns_shape_generation_instructions() {
        let json = r#"{
            "name": "Style Test",
            "description": "Checks prompt semantics",
            "sections": [
                {"title":"Narrative","instruction":"Explain it","format":"paragraph"},
                {"title":"Items","instruction":"Capture them","format":"list"},
                {"title":"Date","instruction":"Record it","format":"string","example_item_format":"YYYY-MM-DD"}
            ]
        }"#;
        let template: Template = serde_json::from_str(json).unwrap();

        let instructions = template.to_section_instructions();
        assert!(instructions.contains("cohesive prose"));
        assert!(instructions.contains("list-oriented content"));
        assert!(instructions.contains("one concise value"));
        assert!(instructions.contains("YYYY-MM-DD"));

        let saved = serde_json::to_value(template).unwrap();
        assert_eq!(saved["sections"][2]["item_format"], "YYYY-MM-DD");
        assert!(saved["sections"][2].get("example_item_format").is_none());
    }
}
