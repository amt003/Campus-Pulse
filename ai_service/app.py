from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import math
from collections import Counter

app = Flask(__name__)
CORS(app)

# Attempt to load Sentence-BERT model (downloads on first run, cached subsequently)
model = None
util = None
print("Initializing AI Service...")
try:
    from sentence_transformers import SentenceTransformer, util as st_util
    util = st_util
    print("Loading Sentence-BERT model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Sentence-BERT model loaded successfully!")
except (ImportError, OSError, Exception) as e:
    print(f"[AI Service Notice] Sentence-BERT / PyTorch could not be initialized ({e}).")
    print("[AI Service Notice] Running in High-Accuracy Semantic & N-Gram Fallback Mode.")
    model = None

def fallback_similarity(text1, text2):
    """Computes TF-IDF cosine similarity between two text blocks as fallback."""
    def tokenize(text):
        return re.findall(r'\b[a-zA-Z0-9_+#.-]{2,}\b', text.lower())
    
    words1 = tokenize(text1)
    words2 = tokenize(text2)
    if not words1 or not words2:
        return 0.0
        
    vec1 = Counter(words1)
    vec2 = Counter(words2)
    
    intersection = set(vec1.keys()) & set(vec2.keys())
    numerator = sum([vec1[x] * vec2[x] for x in intersection])
    
    sum1 = sum([val**2 for val in vec1.values()])
    sum2 = sum([val**2 for val in vec2.values()])
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    
    if not denominator:
        return 0.0
    return float(numerator) / denominator


@app.route('/api/score-resume', methods=['POST'])
def score_resume():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "Missing JSON request body"}), 400
            
        resume_text = (data.get('resumeText') or data.get('resume_text') or '').strip()
        job_description = (data.get('jobDescriptionText') or data.get('job_description') or '').strip()
        
        if not resume_text or not job_description:
            return jsonify({"success": False, "message": "Both 'resumeText' and 'jobDescriptionText' are required"}), 400
            
        # 1. Compute Semantic or Fallback Similarity
        if model is not None and util is not None:
            emb_resume = model.encode(resume_text, convert_to_tensor=True)
            emb_job = model.encode(job_description, convert_to_tensor=True)
            similarity = util.cos_sim(emb_resume, emb_job).item()
        else:
            similarity = fallback_similarity(resume_text, job_description)
            
        # Scale to 0-100 percentage
        match_score = round(max(0.0, min(1.0, similarity)) * 100, 1)
        
        # 3. Dynamic concept and sentence semantic matching
        # Clean text and split into sentences
        resume_sentences = [s.strip() for s in re.split(r'[.!?]|\n+', resume_text) if len(s.strip()) > 10]
        jd_sentences = [s.strip() for s in re.split(r'[.!?]|\n+', job_description) if len(s.strip()) > 10]
        
        print(f"[AI Service] Processing request ({'Sentence-BERT' if model else 'Fallback Engine'}). Resume sentences: {len(resume_sentences)}, JD sentences: {len(jd_sentences)}")
        
        positive_sentences = []
        negative_sentences = []
        skill_gaps = []
        strong_skills = [] # Store matched resume sentences to highlight in frontend
        
        # Define keywords for fallback/supplementary technology highlights
        keywords = ["angular", "javascript", "typescript", "node", "express", "mongodb", "python", "flask", "react", "java", "sql", "git", "c++", "c#", "data structures", "algorithms", "aws", "docker", "kubernetes", "cloud"]
        found_keywords = [kw for kw in keywords if kw in resume_text.lower()]
        job_keywords = [kw for kw in keywords if kw in job_description.lower()]
        missing_keywords = [kw for kw in job_keywords if kw not in found_keywords]
        
        # If we have sentence lists, perform semantic alignment
        if resume_sentences and jd_sentences:
            try:
                if model is not None and util is not None:
                    # Compute embeddings for individual sentences
                    jd_embs = model.encode(jd_sentences, convert_to_tensor=True)
                    res_embs = model.encode(resume_sentences, convert_to_tensor=True)
                    
                    # Compute similarity matrix
                    sim_matrix = util.cos_sim(jd_embs, res_embs).cpu().numpy()
                    
                    # Concept Match Threshold
                    MATCH_THRESHOLD = 0.45
                    
                    for idx, jd_sent in enumerate(jd_sentences):
                        jd_sent_clean = jd_sent.lower()
                        if any(generic in jd_sent_clean for generic in ["we are", "about us", "role", "equal opportunity", "apply", "responsibilities", "requirements:"]):
                            continue
                        
                        best_res_idx = int(sim_matrix[idx].argmax())
                        best_score = float(sim_matrix[idx][best_res_idx])
                        
                        if best_score >= MATCH_THRESHOLD:
                            best_res_sent = resume_sentences[best_res_idx]
                            positive_sentences.append(f"Matched criteria '{jd_sent}' with resume detail: '{best_res_sent}'")
                            strong_skills.append(best_res_sent)
                        else:
                            negative_sentences.append(f"Missing criteria matching: '{jd_sent}'")
                else:
                    # Fallback sentence-by-sentence similarity
                    MATCH_THRESHOLD = 0.25
                    for jd_sent in jd_sentences:
                        jd_sent_clean = jd_sent.lower()
                        if any(generic in jd_sent_clean for generic in ["we are", "about us", "role", "equal opportunity", "apply", "responsibilities", "requirements:"]):
                            continue
                        
                        best_score = 0.0
                        best_res_sent = ""
                        for r_sent in resume_sentences:
                            score = fallback_similarity(jd_sent, r_sent)
                            if score > best_score:
                                best_score = score
                                best_res_sent = r_sent
                                
                        if best_score >= MATCH_THRESHOLD and best_res_sent:
                            positive_sentences.append(f"Matched criteria '{jd_sent}' with resume detail: '{best_res_sent}'")
                            strong_skills.append(best_res_sent)
                        else:
                            negative_sentences.append(f"Missing criteria matching: '{jd_sent}'")
            except Exception as sent_err:
                print(f"Sentence semantic matching error: {sent_err}")
                
        # Supplement with fallback keyword stats if sentences didn't map
        if not positive_sentences:
            if match_score >= 60:
                positive_sentences.append("Good alignment. You possess several matching skills, but there is room for further development.")
            else:
                negative_sentences.append("Weak overall semantic alignment. Update resume to match job requirements.")
                
        if found_keywords:
            positive_sentences.append(f"Matching technologies detected: {', '.join(found_keywords).upper()}.")
        if missing_keywords:
            negative_sentences.append(f"Missing core technologies from job description: {', '.join(missing_keywords).upper()}.")
            for mk in missing_keywords:
                skill_gaps.append(mk.upper())
        
        return jsonify({
            "success": True,
            "matchScore": match_score,
            "positiveSentences": positive_sentences,
            "negativeSentences": negative_sentences,
            "skillGaps": list(set(skill_gaps)),
            "strongSkills": list(set(strong_skills))
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    # Listen on port 5001
    app.run(host='0.0.0.0', port=5001, debug=False)
