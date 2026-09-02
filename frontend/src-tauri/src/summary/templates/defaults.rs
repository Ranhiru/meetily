/// Embedded default templates using compile-time inclusion
///
/// These templates are bundled into the binary and serve as fallbacks
/// when custom templates are not available.

/// Daily standup template for engineering/product teams
pub const DAILY_STANDUP: &str = include_str!("../../../templates/daily_standup.json");

/// Standard meeting notes template
pub const STANDARD_MEETING: &str = include_str!("../../../templates/standard_meeting.json");

pub const CANDIDATE_INTERVIEW: &str = include_str!("../../../templates/candidate_interview.json");
pub const PROJECT_SYNC: &str = include_str!("../../../templates/project_sync.json");
pub const PSYCHIATRIC_SESSION: &str = include_str!("../../../templates/psychatric_session.json");
pub const RETROSPECTIVE: &str = include_str!("../../../templates/retrospective.json");
pub const CLIENT_SALES_MEETING: &str =
    include_str!("../../../templates/sales_marketing_client_call.json");

/// Registry of all built-in templates
///
/// Maps template identifiers to their embedded JSON content
pub fn get_builtin_templates() -> Vec<(&'static str, &'static str)> {
    vec![
        ("candidate_interview", CANDIDATE_INTERVIEW),
        ("client_sales_meeting", CLIENT_SALES_MEETING),
        ("daily_standup", DAILY_STANDUP),
        ("project_sync", PROJECT_SYNC),
        ("psychiatric_session", PSYCHIATRIC_SESSION),
        ("retrospective", RETROSPECTIVE),
        ("standard_meeting", STANDARD_MEETING),
    ]
}

/// Get a built-in template by identifier
///
/// # Arguments
/// * `id` - Template identifier (e.g., "daily_standup", "standard_meeting")
///
/// # Returns
/// The template JSON content if found, None otherwise
pub fn get_builtin_template(id: &str) -> Option<&'static str> {
    get_builtin_templates()
        .into_iter()
        .find_map(|(builtin_id, content)| (builtin_id == id).then_some(content))
}

/// List all built-in template identifiers
pub fn list_builtin_template_ids() -> Vec<&'static str> {
    get_builtin_templates()
        .into_iter()
        .map(|(id, _)| id)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_valid_json() {
        for (id, content) in get_builtin_templates() {
            let result = serde_json::from_str::<serde_json::Value>(content);
            assert!(
                result.is_ok(),
                "Built-in template '{}' contains invalid JSON: {:?}",
                id,
                result.err()
            );
        }
    }

    #[test]
    fn test_get_builtin_template() {
        assert!(get_builtin_template("daily_standup").is_some());
        assert!(get_builtin_template("standard_meeting").is_some());
        assert!(get_builtin_template("nonexistent").is_none());
    }
}
