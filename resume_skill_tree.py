"""
Resume Skill Tree Generator
Extracts skills from a resume PDF and creates an interactive skill tree visualization.
Uses xAI API to analyze and structure skills hierarchically.
"""

import os
import json
import requests
from typing import Dict, Any
from dotenv import load_dotenv

import PyPDF2
import pdfplumber

from skill_tree_common import build_skill_tree, generate_html_visualization

# Load environment variables from .env file in the root directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)


class ResumeSkillTreeGenerator:
    def __init__(self, api_key: str = None):
        """Initialize the resume skill tree generator."""
        if api_key:
            self.api_key = api_key
        else:
            self.api_key = os.getenv('XAI_API_KEY')
            # Strip quotes if present (python-dotenv should handle this, but just in case)
            if self.api_key and (self.api_key.startswith('"') or self.api_key.startswith("'")):
                self.api_key = self.api_key.strip('"\'')
        
        self.api_url = "https://api.x.ai/v1/chat/completions"
        
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF resume."""
        text = ""
  
        # Try pdfplumber first (better for complex layouts)
        if pdfplumber:
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    for page in pdf.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
            except Exception as e:
                print(f"pdfplumber failed, trying PyPDF2: {e}")
        
        # Fallback to PyPDF2
        if not text and PyPDF2:
            try:
                with open(pdf_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    for page in pdf_reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
            except Exception as e2:
                print(f"PyPDF2 also failed: {e2}")
        
        if not text:
            raise Exception("Could not extract text from PDF. Please ensure the PDF is not encrypted or corrupted.")
        
        return text.strip()
    
    def analyze_resume_with_xai(self, resume_text: str) -> Dict[str, Any]:
        """Use xAI API to analyze resume and extract structured skill information."""
        
        prompt = f"""Analyze the following resume and extract all skills, organizing them into a hierarchical skill tree structure.

Resume:
{resume_text}

Please identify:
1. Core technical skills (programming languages, frameworks, tools)
2. Soft skills (communication, leadership, etc.)
3. Domain expertise (AI/ML, web development, etc.)
4. Certifications and qualifications
5. Years of experience or proficiency levels where mentioned

Return a JSON structure with this format:
{{
    "skills": {{
        "technical": {{
            "programming_languages": ["skill1", "skill2"],
            "frameworks": ["skill1", "skill2"],
            "tools": ["skill1", "skill2"],
            "databases": ["skill1", "skill2"],
            "cloud_platforms": ["skill1", "skill2"]
        }},
        "soft_skills": ["skill1", "skill2"],
        "domains": ["domain1", "domain2"],
        "certifications": ["cert1", "cert2"]
    }},
    "experience_levels": {{
        "skill_name": "beginner|intermediate|advanced|expert"
    }},
    "skill_relationships": [
        {{"parent": "parent_skill", "child": "child_skill", "type": "prerequisite|related|specialization"}}
    ]
}}

Only return valid JSON, no additional text."""

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "messages": [
                {
                    "role": "system",
                    "content": "You are an expert resume analyzer. Extract skills and create a structured skill tree. Always return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "model": "grok-4-latest",
            "stream": False,
            "temperature": 0.3
        }
        
        try:
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            
            # Extract the JSON from the response
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '{}')
            
            # Try to parse JSON from the content
            # Sometimes the API wraps it in markdown code blocks
            content = content.strip()
            if content.startswith('```'):
                # Remove markdown code blocks
                lines = content.split('\n')
                content = '\n'.join([line for line in lines if not line.strip().startswith('```')])
            
            skill_data = json.loads(content)
            return skill_data
            
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            print(f"Response content: {content[:500]}")
            # Return a fallback structure
            return self._fallback_skill_extraction(resume_text)
        except Exception as e:
            print(f"Error calling xAI API: {e}")
            return self._fallback_skill_extraction(resume_text)
    
    def _fallback_skill_extraction(self, resume_text: str) -> Dict[str, Any]:
        """Fallback skill extraction using keyword matching if API fails."""
        # Common technical skills to look for
        tech_keywords = {
            'programming_languages': ['Python', 'JavaScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'TypeScript', 'SQL', 'R', 'Swift', 'Kotlin'],
            'frameworks': ['React', 'Vue', 'Angular', 'Django', 'Flask', 'FastAPI', 'Spring', 'Node.js', 'Express', 'TensorFlow', 'PyTorch'],
            'tools': ['Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Jenkins', 'CI/CD', 'Linux', 'MongoDB', 'PostgreSQL', 'Redis']
        }
        
        found_skills = {'programming_languages': [], 'frameworks': [], 'tools': []}
        
        resume_lower = resume_text.lower()
        for category, keywords in tech_keywords.items():
            for keyword in keywords:
                if keyword.lower() in resume_lower:
                    found_skills[category].append(keyword)
        
        return {
            "skills": {
                "technical": found_skills,
                "soft_skills": [],
                "domains": [],
                "certifications": []
            },
            "experience_levels": {},
            "skill_relationships": []
        }
    
    def generate_skill_tree(self, pdf_path: str, output_json: str = "resume_skill_tree.json", output_html: str = "resume_skill_tree.html"):
        """Main method to generate skill tree from resume PDF."""
        print(f"Extracting text from {pdf_path}...")
        resume_text = self.extract_text_from_pdf(pdf_path)
        print(f"Extracted {len(resume_text)} characters from PDF")
        
        if self.api_key:
            print("Analyzing resume with xAI API...")
            skill_data = self.analyze_resume_with_xai(resume_text)
        else:
            print("No API key found, using fallback extraction...")
            skill_data = self._fallback_skill_extraction(resume_text)
        
        print("Building skill tree structure...")
        skill_tree = build_skill_tree(skill_data)
        
        # Save JSON
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(skill_tree, f, indent=2, ensure_ascii=False)
        print(f"Saved skill tree JSON to {output_json}")
        
        # Generate HTML visualization
        generate_html_visualization(skill_tree, output_html, "Resume Skill Tree")
        print(f"Generated HTML visualization: {output_html}")
        
        return skill_tree


def main():
    """Main entry point."""
    import sys
    
    pdf_path = "AlbertoMejiaResume.pdf"
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(f"Error: Resume PDF not found at {pdf_path}")
        return
    
    generator = ResumeSkillTreeGenerator()
    skill_tree = generator.generate_skill_tree(pdf_path)
    
    print("\n[SUCCESS] Skill tree generated successfully!")
    print(f"[*] Open resume_skill_tree.html in your browser to view the visualization")


if __name__ == "__main__":
    main()

