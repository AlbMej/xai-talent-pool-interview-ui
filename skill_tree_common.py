"""
Common functions for building and visualizing skill trees.
"""

from typing import Dict, Any, List


def build_skill_tree(skill_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build a hierarchical skill tree structure from extracted skill data.
    
    Args:
        skill_data: Dictionary containing skills organized by category
        
    Returns:
        Dictionary representing the skill tree structure
    """
    root = {
        "name": "Skills",
        "children": []
    }
    
    # Technical Skills
    technical_skills = skill_data.get("skills", {}).get("technical", {})
    if technical_skills:
        tech_node = {
            "name": "Technical Skills",
            "children": []
        }
        
        # Programming Languages
        if technical_skills.get("programming_languages"):
            tech_node["children"].append({
                "name": "Programming Languages",
                "children": [
                    {"name": skill, "type": "skill"}
                    for skill in technical_skills["programming_languages"]
                ]
            })
        
        # Frameworks
        if technical_skills.get("frameworks"):
            tech_node["children"].append({
                "name": "Frameworks",
                "children": [
                    {"name": skill, "type": "skill"}
                    for skill in technical_skills["frameworks"]
                ]
            })
        
        # Tools
        if technical_skills.get("tools"):
            tech_node["children"].append({
                "name": "Tools",
                "children": [
                    {"name": skill, "type": "skill"}
                    for skill in technical_skills["tools"]
                ]
            })
        
        # Databases
        if technical_skills.get("databases"):
            tech_node["children"].append({
                "name": "Databases",
                "children": [
                    {"name": skill, "type": "skill"}
                    for skill in technical_skills["databases"]
                ]
            })
        
        # Cloud Platforms
        if technical_skills.get("cloud_platforms"):
            tech_node["children"].append({
                "name": "Cloud Platforms",
                "children": [
                    {"name": skill, "type": "skill"}
                    for skill in technical_skills["cloud_platforms"]
                ]
            })
        
        # Other technical categories
        for key, value in technical_skills.items():
            if key not in ["programming_languages", "frameworks", "tools", "databases", "cloud_platforms"]:
                if value and isinstance(value, list):
                    tech_node["children"].append({
                        "name": key.replace("_", " ").title(),
                        "children": [
                            {"name": skill, "type": "skill"}
                            for skill in value
                        ]
                    })
        
        if tech_node["children"]:
            root["children"].append(tech_node)
    
    # Soft Skills
    soft_skills = skill_data.get("skills", {}).get("soft_skills", [])
    if soft_skills:
        root["children"].append({
            "name": "Soft Skills",
            "children": [
                {"name": skill, "type": "skill"}
                for skill in soft_skills
            ]
        })
    
    # Domains
    domains = skill_data.get("skills", {}).get("domains", [])
    if domains:
        root["children"].append({
            "name": "Domain Expertise",
            "children": [
                {"name": domain, "type": "skill"}
                for domain in domains
            ]
        })
    
    # Certifications
    certifications = skill_data.get("skills", {}).get("certifications", [])
    if certifications:
        root["children"].append({
            "name": "Certifications",
            "children": [
                {"name": cert, "type": "skill"}
                for cert in certifications
            ]
        })
    
    # Methodologies & Techniques (if present)
    methodologies = skill_data.get("skills", {}).get("methodologies", [])
    if methodologies:
        root["children"].append({
            "name": "Methodologies & Techniques",
            "children": [
                {"name": method, "type": "skill"}
                for method in methodologies
            ]
        })
    
    return root


def generate_html_visualization(skill_tree: Dict[str, Any], output_html: str, title: str = "Skill Tree"):
    """
    Generate an HTML visualization of the skill tree.
    
    Args:
        skill_tree: Dictionary representing the skill tree
        output_html: Path to output HTML file
        title: Title for the HTML page
    """
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            padding: 20px;
            background: #f5f5f5;
        }}
        .skill-tree {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .skill-node {{
            margin: 10px 0;
            padding: 10px;
            border-left: 3px solid #3b82f6;
            background: #f9fafb;
        }}
        .skill-node-name {{
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 5px;
        }}
        .skill-item {{
            margin: 5px 0;
            padding: 5px 10px;
            background: white;
            border-radius: 4px;
            display: inline-block;
            margin-right: 10px;
        }}
        .skill-type {{
            font-size: 12px;
            color: #6b7280;
            margin-left: 10px;
        }}
    </style>
</head>
<body>
    <div class="skill-tree">
        <h1>{title}</h1>
        {_render_tree_html(skill_tree)}
    </div>
</body>
</html>
"""
    
    with open(output_html, 'w', encoding='utf-8') as f:
        f.write(html_content)


def _render_tree_html(node: Dict[str, Any], level: int = 0) -> str:
    """Recursively render tree nodes as HTML."""
    indent = "  " * level
    html = f"{indent}<div class='skill-node'>\n"
    html += f"{indent}  <div class='skill-node-name'>{node['name']}</div>\n"
    
    if node.get('children'):
        for child in node['children']:
            if child.get('type') == 'skill':
                html += f"{indent}  <span class='skill-item'>{child['name']}<span class='skill-type'>({child.get('type', 'skill')})</span></span>\n"
            else:
                html += _render_tree_html(child, level + 1)
    
    html += f"{indent}</div>\n"
    return html

