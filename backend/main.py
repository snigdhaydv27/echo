from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
import chromadb
import uuid
import os
import time
from dotenv import load_dotenv

# Load environment variables from a local .env file
load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Initialize Long-Term Vector Memory
chroma_client = chromadb.PersistentClient(path="./agent_memory")
memory_collection = chroma_client.get_or_create_collection(name="user_memories")

# 2. Connect to Your Fine-Tuned Model on Hugging Face using secure environment variables
HF_TOKEN = os.getenv("HF_TOKEN")
MODEL_ID = "meta-llama/Llama-3.2-3B-Instruct"

client = InferenceClient(token=HF_TOKEN)
print(f"System Ready. Connected to custom model: {MODEL_ID}")

class ChatRequest(BaseModel):
    message: str

chat_history = []

@app.get("/health")
def health_check():
    return {"status": "alive"}

def safe_chat_completion(messages, max_tokens=250, temperature=0.3):
    """Retries model invocation and manually formats prompts for custom models."""
    
    # Manually format the chat history into Llama 3's required prompt structure
    prompt = "<|begin_of_text|>"
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        prompt += f"<|start_header_id|>{role}<|end_header_id|>\n\n{content}<|eot_id|>"
    prompt += "<|start_header_id|>assistant<|end_header_id|>\n\n"

    for attempt in range(3):
        try:
            # Use text_generation instead of chat_completion to bypass the error
            response = client.text_generation(
                prompt=prompt,
                model=MODEL_ID,
                max_new_tokens=max_tokens,
                temperature=temperature,
                return_full_text=False # Ensures it only returns the AI's reply, not the prompt
            )
            return response.strip()
        except Exception as e:
            print(f"Attempt {attempt + 1} model loading/waking up: {e}")
            if attempt < 2:
                time.sleep(10)
            else:
                raise e

def extract_and_memorize(user_input: str):
    """Runs silently in the background to extract factual memory."""
    system_prompt = (
        "Extract factual information from the user's statement. Convert pronouns like 'I' or 'my' to 'The user'. "
        "Break compound sentences into distinct facts separated by periods. "
        "CRITICAL: If the input is a question, a greeting (hi, hello), or conversational filler (ok, yes, thanks, cool), output exactly NONE.\n"
        "Example Input: 'my name is snigdha i love dogs'\n"
        "Example Output: 'The user's name is Snigdha. The user loves dogs.'\n"
        "Example Input: 'ok'\n"
        "Example Output: NONE"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]

    try:
        fact = safe_chat_completion(messages, max_tokens=150, temperature=0.1)

        if fact and "NONE" not in fact.upper():
            memory_collection.add(
                documents=[fact],
                ids=[str(uuid.uuid4())]
            )
            print(f"🧠 AUTO-LEARNED: {fact}")
    except Exception as e:
        print(f"Extraction failed: {e}")

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    global chat_history

    # Query ChromaDB for relevant facts
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
        "If the memory contains relevant facts, use them seamlessly and naturally in your response. "
        "If no memory is provided or needed, respond normally and politely like a human would. "
        "Never say 'I don't have information' for basic greetings."
        f"{memory_context}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in chat_history[-4:]:
        messages.append({"role": msg['role'], "content": msg['content']})
    messages.append({"role": "user", "content": request.message})

    try:
        response_text = safe_chat_completion(messages, max_tokens=250, temperature=0.3)
    except Exception as e:
        print(f"Inference error: {e}")
        response_text = "The AI model is currently waking up or encountered an issue. Please try again in a few seconds."

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