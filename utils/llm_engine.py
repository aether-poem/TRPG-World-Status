import json
import os

import requests
from dotenv import load_dotenv


load_dotenv()

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEESEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


WORLD_STATE_SYSTEM_PROMPT = """
You are a digital-humanities ontology assistant and TRPG world-state designer.
Convert narrative prose into a structured JSON world state.

Return valid JSON only. Do not include Markdown.
Use concise Chinese values unless the source text contains proper nouns that
should stay in the original language.

Interpret the output through a three-layer ontology:
1. Micro layer: Character and NarrativeObject/Clue.
2. Meso layer: CollectiveAgent, Place, social relations, and group belonging.
3. Macro layer: NarrativeEvent, Quest, OpenThread, event order, and scenario evolution.

Keep the JSON practical and compatible with the current application. Do not add
extra top-level ontology tables unless the user text clearly supports them.
""".strip()


def build_world_state_prompt(text):
    return f"""
请从下面的文本中提取并填写 TRPG 世界状态 JSON。

输出必须是一个 JSON object，顶层字段必须包含：
- summary: 当前剧情摘要。
- characters: 人物数组。每个人物包含 name, description, goals, secrets, status。
  - goals 表示人物意图。
  - secrets 表示隐藏信息、未明说的记忆或叙事知识差。
  - status 表示当前状态。
- locations: 地点数组。每个地点包含 name, description, hazards, clues。
  - locations 在本体中对应 Place。
  - clues 可记录空间中可被解释或调查的线索。
- factions: 群体行动者/阵营数组。每项包含 name, agenda, resources, relationships。
  - factions 在本体中对应 CollectiveAgent。
  - relationships 可写人物与群体、群体与群体之间的关系。
- items: 叙事物件/线索数组。每项包含 name, description, owner, importance。
  - items 在论文表述中应理解为 NarrativeObject / Clue，不限于物理道具。
  - owner 对应 hasOwner / isOwnedBy，可写人物、群体、地点或“公共歌曲”等来源。
  - importance 表示象征价值、激发回忆的功能或叙事解释价值。
- relationships: 人物/群体关系断言数组。每项包含 source, target, relation。
  - 对应 hasSocialRelationWith。
  - relation 应写清关系性质，例如“夫妻，情感存在隔阂”。
- timeline: 弱结构化叙事事件数组。
  - 每项用字符串概括一个 NarrativeEvent。
  - 数组顺序可推导 precedes / follows。
- quests: 可供玩家推进的任务数组。每项包含 title, hook, objective, stakes。
  - 对应 Quest，可从情节冲突、开放线索或人物意图转化。
- open_threads: 开放线索/未决问题数组。
  - 对应 OpenThread，用字符串表达解释问题或后续行动可能。
- context_variables: 全局语境变量 object，必须包含 atmosphere 和 scene_state。
  - atmosphere 是场景基调、心理压力、主题氛围等全局约束变量。
  - scene_state 是当前世界状态或改编场景的整体条件。
  - 不要把 atmosphere 和 scene_state 当作普通概念类或独立实体。

低成本对象属性推导原则：
- items.owner 可转写为 hasOwner。
- items.importance 与 timeline 可归纳 evokesMemory。
- factions.relationships 与 characters.description 可归纳 belongsToCollective。
- timeline 的顺序可归纳 precedes。
- quests 与 open_threads 可归纳 containsQuest。
这些对象属性不需要新增 JSON 字段，只需要在现有字段的自然语言内容中表达清楚。

如果某项没有信息，请使用空数组、空字符串或空对象，不要编造确定事实。

文本：
{text}
""".strip()


def _extract_content(payload):
    return payload["choices"][0]["message"]["content"]


def _normalize_world_state(world_state):
    """Keep legacy atmosphere/scene_state usable while preferring context_variables."""
    if not isinstance(world_state, dict):
        return world_state

    context = world_state.get("context_variables")
    if not isinstance(context, dict):
        context = {}

    if "atmosphere" not in context:
        context["atmosphere"] = world_state.pop("atmosphere", "")
    else:
        world_state.pop("atmosphere", None)

    if "scene_state" not in context:
        context["scene_state"] = world_state.pop("scene_state", "")
    else:
        world_state.pop("scene_state", None)

    world_state["context_variables"] = context
    return world_state


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
        world_state = _normalize_world_state(json.loads(content))
    except json.JSONDecodeError:
        world_state = {"raw": content}

    return {
        "model": DEEPSEEK_MODEL,
        "world_state": world_state,
        "usage": payload.get("usage", {}),
    }


def generate_trpg_response(text):
    return generate_world_state(text)
