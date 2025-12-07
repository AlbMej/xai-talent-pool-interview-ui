from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import json
import os
import glob
import re
import uuid
import hashlib
import requests
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from resume_skill_tree import ResumeSkillTreeGenerator

# Load environment variables from .env file in the root directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

def get_api_key():
    """Get XAI API key from environment, stripping quotes if present."""
    api_key = os.getenv('XAI_API_KEY')
    if api_key and (api_key.startswith('"') or api_key.startswith("'")):
        api_key = api_key.strip('"\'')
    return api_key

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
CANDIDATE_SKILL_TREES_DIR = os.path.join(os.path.dirname(__file__), 'data', 'candidate_skill_trees')
JOB_SKILL_TREES_DIR = os.path.join(os.path.dirname(__file__), 'data', 'job_skill_trees')
ALLOWED_EXTENSIONS = {'pdf'}

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CANDIDATE_SKILL_TREES_DIR, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Default skill tree data
DEFAULT_SKILL_TREE = {
    "name": "Skills",
    "children": [
        {
            "name": "Technical Skills",
            "children": [
                {
                    "name": "Programming Languages",
                    "children": [
                        {"name": "Python", "type": "skill"},
                        {"name": "Rust", "type": "skill"}
                    ]
                },
                {
                    "name": "Frameworks",
                    "children": [
                        {"name": "Jax", "type": "skill"}
                    ]
                },
                {
                    "name": "Technologies",
                    "children": [
                        {"name": "large-scale distributed machine learning systems", "type": "skill"}
                    ]
                }
            ]
        },
        {
            "name": "ML/AI Concepts",
            "children": [
                {"name": "fine-tuning large language models", "type": "skill"},
                {"name": "reinforcement learning", "type": "skill"},
                {"name": "reward models", "type": "skill"},
                {"name": "model evaluation", "type": "skill"},
                {"name": "inference-time search techniques", "type": "skill"},
                {"name": "model optimizations", "type": "skill"}
            ]
        },
        {
            "name": "Methodologies & Techniques",
            "children": [
                {"name": "data collection pipelines", "type": "skill"},
                {"name": "data generation techniques", "type": "skill"},
                {"name": "reinforcement learning algorithms", "type": "skill"},
                {"name": "model training frameworks", "type": "skill"}
            ]
        },
        {
            "name": "Domain Expertise",
            "children": [
                {"name": "post-training", "type": "skill"},
                {"name": "pre-training", "type": "skill"},
                {"name": "reasoning", "type": "skill"},
                {"name": "multimodal", "type": "skill"}
            ]
        }
    ],
    "job_id": 4374125007,
    "job_title": "Member of Technical Staff, Post-training",
    "location": "Palo Alto, CA; San Francisco, CA"
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/v1/jobs', methods=['GET'])
def list_jobs():
    """List all available jobs"""
    jobs = []
    json_files = glob.glob(os.path.join(JOB_SKILL_TREES_DIR, 'job_*.json'))
    
    for json_file in json_files:
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                job_id = data.get('job_id')
                job_title = data.get('job_title', 'Unknown')
                location = data.get('location', '')
                
                if job_id:
                    jobs.append({
                        'job_id': job_id,
                        'job_title': job_title,
                        'location': location
                    })
        except Exception as e:
            print(f"Error reading {json_file}: {e}")
            continue
    
    # Sort by job title
    jobs.sort(key=lambda x: x['job_title'])
    return jsonify({'jobs': jobs})

@app.route('/api/v1/skill-trees/<job_id>', methods=['GET'])
def get_skill_tree(job_id):
    """Get skill tree by job ID"""
    # Try to find the job file
    json_files = glob.glob(os.path.join(JOB_SKILL_TREES_DIR, f'job_{job_id}_*.json'))
    
    if json_files:
        try:
            with open(json_files[0], 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except Exception as e:
            print(f"Error reading skill tree for job {job_id}: {e}")
    
    # Fallback to default
    return jsonify(DEFAULT_SKILL_TREE)

@app.route('/api/v1/skill-trees/default', methods=['GET'])
def get_default_skill_tree():
    """Get default skill tree"""
    return jsonify(DEFAULT_SKILL_TREE)

def generate_questions_with_grok(job_skill_tree, candidate_skill_tree, job_title, location):
    """Use Grok API to generate interview questions by comparing job requirements and candidate skills"""
    api_key = get_api_key()
    if not api_key:
        return None
    
    api_url = "https://api.x.ai/v1/chat/completions"
    
    # Extract key information from skill trees
    job_skills = extract_skills_from_tree(job_skill_tree) if job_skill_tree else []
    candidate_skills = extract_skills_from_tree(candidate_skill_tree) if candidate_skill_tree else []
    
    # Build a job description summary from the skill tree
    job_description = f"Position: {job_title}"
    if location:
        job_description += f" in {location}"
    
    # Add requirements from the skill tree
    requirements = []
    def extract_requirements(node):
        if node.get('type') == 'requirement':
            requirements.append(node.get('name', ''))
        if node.get('children'):
            for child in node['children']:
                extract_requirements(child)
    
    if job_skill_tree:
        extract_requirements(job_skill_tree)
    
    job_description += f"\n\nKey Requirements:\n" + "\n".join(f"- {req}" for req in requirements[:10])
    job_description += f"\n\nRequired Skills: {', '.join(job_skills[:15])}"
    
    # Build candidate summary
    candidate_summary = "Candidate Skills: " + ", ".join(candidate_skills[:15]) if candidate_skills else "No candidate resume uploaded yet."
    
    prompt = f"""You are an expert interview question generator. Generate personalized interview questions by comparing a job posting with a candidate's resume.

Job Description:
{job_description}

{candidate_summary}

Generate 8-10 high-quality interview questions that:
1. Assess the candidate's fit for the specific role and requirements
2. Explore gaps between required skills and candidate's skills
3. Test depth of knowledge in key technical areas
4. Evaluate experience with specific technologies mentioned in the job
5. Probe areas where the candidate may need to demonstrate competency

If candidate skills are provided, tailor questions to:
- Validate claimed skills
- Explore experience with technologies that match job requirements
- Address any skill gaps between job requirements and candidate profile

Return ONLY a JSON array of question strings, no additional text or formatting:
["Question 1", "Question 2", "Question 3", ...]

Example format:
["Can you describe your experience with Kubernetes in production environments?", "How have you handled disaster recovery scenarios?", ...]"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "messages": [
            {
                "role": "system",
                "content": "You are an expert interview question generator. Always return valid JSON arrays only, no markdown or additional text."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "model": "grok-4-fast",
        "stream": False,
        "temperature": 0.7
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '[]')
        content = content.strip()
        
        # Remove markdown code blocks if present
        if content.startswith('```'):
            lines = content.split('\n')
            content = '\n'.join([line for line in lines if not line.strip().startswith('```')])
        
        questions = json.loads(content)
        
        # Ensure we have a list of strings
        if isinstance(questions, list) and all(isinstance(q, str) for q in questions):
            return questions[:10]  # Return up to 10 questions
        else:
            return None
            
    except Exception as e:
        print(f"Error calling Grok API for question generation: {e}")
        return None

@app.route('/api/v1/generate-interview-questions', methods=['POST'])
def generate_questions():
    """Generate interview questions based on skill tree, job description, and candidate resume"""
    data = request.json
    job_skill_tree = data.get('job_skill_tree')
    candidate_skill_tree = data.get('candidate_skill_tree')
    job_title = data.get('job_title', 'Software Engineer')
    location = data.get('location', '')
    
    # Try to generate questions using Grok API
    api_key = get_api_key()
    if api_key and job_skill_tree:
        try:
            questions = generate_questions_with_grok(
                job_skill_tree, 
                candidate_skill_tree, 
                job_title, 
                location
            )
            if questions:
                return jsonify({"questions": questions})
        except Exception as e:
            print(f"Error generating questions with Grok: {e}")
            # Fall back to hardcoded questions
    
    # Fallback to hardcoded questions
    skills = data.get('skills', '')
    questions = [
        f"Can you explain why you are a good fit for our {job_title} position?",
        "What technical challenges have you faced in your previous projects?",
        "How do you approach problem-solving in a technical context?",
        "Can you describe a complex project you've worked on?",
        "What methodologies do you use for software development?"
    ]
    
    # If skills provided, add skill-specific questions
    if skills:
        skill_list = skills.split(',')[:3]
        for skill in skill_list:
            questions.append(f"Can you tell me about your experience with {skill.strip()}?")
    
    return jsonify({"questions": questions[:8]})

def extract_skills_from_tree(tree, skills_list=None):
    """Recursively extract all skills from a skill tree"""
    if skills_list is None:
        skills_list = []
    
    if tree.get('type') == 'skill' or tree.get('type') == 'requirement':
        skills_list.append(tree.get('name', '').lower())
    
    if tree.get('children'):
        for child in tree['children']:
            extract_skills_from_tree(child, skills_list)
    
    return skills_list

def find_skill_similarities_with_grok(job_skills, candidate_skills):
    """Use Grok API to find similar skills between job and candidate"""
    api_key = get_api_key()
    if not api_key:
        # Fallback to simple matching if no API key
        return find_skill_similarities_simple(job_skills, candidate_skills)
    
    api_url = "https://api.x.ai/v1/chat/completions"
    
    prompt = f"""You are a skill matching expert. Compare the following two lists of skills and identify which candidate skills match or are similar to job skills.

Job Skills:
{json.dumps(job_skills, indent=2)}

Candidate Skills:
{json.dumps(candidate_skills, indent=2)}

For each candidate skill, determine if it matches or is similar to any job skill. Consider:
- Exact matches (case-insensitive)
- Synonyms (e.g., "Python" matches "Python programming")
- Related skills (e.g., "React" matches "React.js" or "React framework")
- Abbreviations (e.g., "ML" matches "Machine Learning")

Return a JSON object with this structure:
{{
    "matches": [
        {{
            "candidate_skill": "candidate skill name",
            "job_skill": "matching job skill name",
            "similarity": "exact|synonym|related"
        }}
    ],
    "candidate_only": ["skill1", "skill2"],
    "job_only": ["skill1", "skill2"]
}}

Only return valid JSON, no additional text."""

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "messages": [
            {
                "role": "system",
                "content": "You are a skill matching expert. Always return valid JSON only."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "model": "grok-4-fast",
        "stream": False,
        "temperature": 0.1
    }
    
    try:
        response = requests.post(api_url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        content = result.get('choices', [{}])[0].get('message', {}).get('content', '{}')
        content = content.strip()
        
        # Remove markdown code blocks if present
        if content.startswith('```'):
            lines = content.split('\n')
            content = '\n'.join([line for line in lines if not line.strip().startswith('```')])
        
        similarity_data = json.loads(content)
        return similarity_data
        
    except Exception as e:
        print(f"Error calling Grok API for skill matching: {e}")
        # Fallback to simple matching
        return find_skill_similarities_simple(job_skills, candidate_skills)

def find_skill_similarities_simple(job_skills, candidate_skills):
    """Simple fallback matching using lowercase comparison"""
    job_skills_lower = [s.lower() for s in job_skills]
    candidate_skills_lower = [s.lower() for s in candidate_skills]
    
    matches = []
    candidate_only = []
    job_only = []
    
    for candidate_skill in candidate_skills:
        candidate_lower = candidate_skill.lower()
        matched = False
        for job_skill in job_skills:
            job_lower = job_skill.lower()
            if candidate_lower == job_lower or candidate_lower in job_lower or job_lower in candidate_lower:
                matches.append({
                    "candidate_skill": candidate_skill,
                    "job_skill": job_skill,
                    "similarity": "exact" if candidate_lower == job_lower else "related"
                })
                matched = True
                break
        if not matched:
            candidate_only.append(candidate_skill)
    
    for job_skill in job_skills:
        job_lower = job_skill.lower()
        if not any(job_lower == m["job_skill"].lower() for m in matches):
            job_only.append(job_skill)
    
    return {
        "matches": matches,
        "candidate_only": candidate_only,
        "job_only": job_only
    }

@app.route('/api/v1/upload-resume', methods=['POST'])
def upload_resume():
    """Handle resume upload and generate candidate skill tree"""
    if 'resume' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['resume']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only PDF files are allowed.'}), 400
    
    try:
        # Save uploaded file temporarily to calculate hash
        filename = secure_filename(file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower()
        temp_file_id = str(uuid.uuid4())
        temp_saved_filename = f"{temp_file_id}.{file_ext}"
        temp_file_path = os.path.join(UPLOAD_FOLDER, temp_saved_filename)
        file.save(temp_file_path)
        
        # Calculate hash of file content to identify if we've seen this resume before
        with open(temp_file_path, 'rb') as f:
            file_hash = hashlib.md5(f.read()).hexdigest()
        
        # Use hash as file_id for deterministic identification
        file_id = file_hash[:16]  # Use first 16 chars of hash as file_id
        output_json = os.path.join(CANDIDATE_SKILL_TREES_DIR, f"candidate_{file_id}_skill_tree.json")
        
        # Check if skill tree already exists
        if os.path.exists(output_json):
            print(f"Found existing skill tree for resume (hash: {file_id}), loading from cache...")
            with open(output_json, 'r', encoding='utf-8') as f:
                candidate_skill_tree = json.load(f)
        else:
            # Generate skill tree
            print(f"Generating new skill tree for resume (hash: {file_id})...")
            generator = ResumeSkillTreeGenerator()
            candidate_skill_tree = generator.generate_skill_tree(temp_file_path, output_json=output_json)
        
        # Clean up temporary uploaded file
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        # Get current job skill tree if available
        job_id = request.form.get('job_id')
        job_skill_tree = None
        if job_id:
            json_files = glob.glob(os.path.join(JOB_SKILL_TREES_DIR, f'job_{job_id}_*.json'))
            if json_files:
                with open(json_files[0], 'r', encoding='utf-8') as f:
                    job_skill_tree = json.load(f)
        
        # If no job_id provided, try to get from current session or use default
        if not job_skill_tree:
            # Try to get from request or use a default
            job_skill_tree = DEFAULT_SKILL_TREE
        
        # Extract skills from both trees
        job_skills = extract_skills_from_tree(job_skill_tree)
        candidate_skills = extract_skills_from_tree(candidate_skill_tree)
        
        # Find skill similarities using Grok
        similarity_data = find_skill_similarities_with_grok(job_skills, candidate_skills)
        
        return jsonify({
            'success': True,
            'skill_tree': candidate_skill_tree,
            'file_id': file_id,
            'similarity_data': similarity_data
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/candidate-skill-trees/<file_id>', methods=['GET'])
def get_candidate_skill_tree(file_id):
    """Get candidate skill tree by file ID"""
    json_file = os.path.join(CANDIDATE_SKILL_TREES_DIR, f"candidate_{file_id}_skill_tree.json")
    
    if os.path.exists(json_file):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                return jsonify(json.load(f))
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Skill tree not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)

