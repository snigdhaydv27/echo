from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import chromadb
import uuid
import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chroma_client = chromadb.PersistentClient(path="./agent_memory")
memory_collection = chroma_client.get_or_create_collection(name="user_memories")

HF_TOKEN = os.getenv("HF_TOKEN")
MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"
API_URL = "https://router.huggingface.co/hf-inference/v1/chat/completions"

class ChatRequest(BaseModel):
    message: str

chat_history = []

@app.get("/health")
def health_check():
    return {"status": "alive"}

def safe_chat_completion(messages, max_tokens=250):
    # 1. Catch missing Render token instantly
    if not HF_TOKEN:
        return "FATAL ERROR: HF_TOKEN is missing. You must add it in the Render Dashboard Environment Variables."

    headers = {
        "Authorization": f"Bearer {HF_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL_ID,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.3
    }

    # 2. Raw HTTP request to completely bypass SDK routing bugs
    for attempt in range(3):
        try:
            response = requests.post(API_URL, headers=headers, json=payload, timeout=30)
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"].strip()
            elif response.status_code == 503:
                time.sleep(3)  # Wait for model to wake up
            else:
                return f"HF API ERROR {response.status_code}: {response.text}"
        except Exception as e:
            return f"SERVER ERROR: {str(e)}"
    
    return "ERROR: Timeout after 3 attempts."

def extract_and_memorize(user_input: str):
    system_prompt = (
        "Extract factual information from the user's statement. Convert pronouns like 'I' or 'my' to 'The user'. "
        "Break compound sentences into distinct facts separated by periods. "
        "CRITICAL: If the input is a question, a greeting, or conversational filler, output exactly NONE.\n"
        "Example Input: 'my name is snigdha i love dogs'\n"
        "Example Output: 'The user's name is Snigdha. The user loves dogs.'\n"
        "Example Input: 'ok'\n"
        "Example Output: NONE"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]
    
    fact = safe_chat_completion(messages, max_tokens=150)
    if fact and "NONE" not in fact.upper() and "ERROR" not in fact:
        try:
            memory_collection.add(
                documents=[fact],
                ids=[str(uuid.uuid4())]
            )
            print(f"🧠 AUTO-LEARNED: {fact}")
        except:
            pass

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    global chat_history

    results = memory_collection.query(
        query_texts=[request.message],
        n_results=5
    )

    memory_context = ""
    if results['documents'] and len(results['documents'][0]) > 0:
        memory_context = "\n<LONG_TERM_MEMORY>\n"
        for mem in results['documents'][0]:
            memory_context += f"- {mem}\n"
        memory_context += "</LONG_TERM_MEMORY>\n"

    system_prompt = (
        "You are a friendly, natural, and highly intelligent AI assistant named Echo. "
        "You have access to past memories in the <LONG_TERM_MEMORY> block. "
        "If the memory contains relevant facts, use them seamlessly in your response. "
        "If no memory is provided or needed, respond normally like a human would. "
        f"{memory_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history[-4:]:
        messages.append({"role": msg['role'], "content": msg['content']})
    messages.append({"role": "user", "content": request.message})

    # 3. Output the exact string (success or error) directly to PowerShell
    response_text = safe_chat_completion(messages, max_tokens=250)

    if "ERROR" not in response_text:
        chat_history.append({"role": "user", "content": request.message})
        chat_history.append({"role": "assistant", "content": response_text})
        if len(chat_history) > 10:
            chat_history = chat_history[-10:]
        background_tasks.add_task(extract_and_memorize, request.message)

    return {"reply": response_text}

@app.post("/api/clear")
def clear_endpoint():
    global chat_history
    chat_history = []
    return {"status": "Cleared"}