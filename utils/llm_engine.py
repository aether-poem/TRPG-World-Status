import json
import os

import requests
from dotenv import load_dotenv


load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEESEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


WORLD_STATE_SYSTEM_PROMPT = """
You are a TRPG world-state designer. Convert narrative prose into a structured
world state for a tabletop role-playing game.

Return valid JSON only. Do not include Markdown.
Use concise Chinese values unless the source text contains proper nouns that
should stay in the original language.
""".strip()


def build_world_state_prompt(text):
    return f"""
请从下面的文本中提取并填写 TRPG 世界状态。

JSON 顶层字段必须包含：
- summary: 当前剧情摘要
- characters: 角色数组，每个角色包含 name, description, goals, secrets, status
- locations: 地点数组，每个地点包含 name, description, hazards, clues
- factions: 阵营或组织数组，每项包含 name, agenda, resources, relationships
- items: 重要物品数组，每项包含 name, description, owner, importance
- relationships: 人物/阵营关系数组，每项包含 source, target, relation
- timeline: 已发生事件数组
- quests: 可供玩家推进的任务数组，每项包含 title, hook, objective, stakes
- open_threads: 尚未解决的悬念数组
- atmosphere: 场景氛围
- scene_state: 下一幕开始时的状态

如果某项没有信息，请使用空数组或空字符串，不要编造确定事实。

文本：
{text}
""".strip()


def _extract_content(payload):
    return payload["choices"][0]["message"]["content"]


def generate_world_state(text, temperature=0.2):
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("Missing DEEPSEEK_API_KEY. Set it in .env before calling DeepSeek.")

    url = f"{DEEPSEEK_API_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    data = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": WORLD_STATE_SYSTEM_PROMPT},
            {"role": "user", "content": build_world_state_prompt(text)},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }

    response = requests.post(url, headers=headers, json=data, timeout=120)
    response.raise_for_status()

    payload = response.json()
    content = _extract_content(payload)
    try:
        world_state = json.loads(content)
    except json.JSONDecodeError:
        world_state = {"raw": content}

    return {
        "model": DEEPSEEK_MODEL,
        "world_state": world_state,
        "usage": payload.get("usage", {}),
    }


def generate_trpg_response(text):
    return generate_world_state(text)
