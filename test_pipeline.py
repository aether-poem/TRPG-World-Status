from utils.llm_engine import _normalize_world_state, build_world_state_prompt
from utils.text_processor import local_sentence_tokenize


def test_ontology_prompt_contains_context_variables():
    prompt = build_world_state_prompt("Alice saw Bob. She waved to him.")
    assert "context_variables" in prompt
    assert "叙事物件/线索" in prompt
    assert "弱结构化叙事事件" in prompt
    assert "belongsToCollective" in prompt


def test_legacy_context_fields_are_normalized():
    world_state = {
        "summary": "demo",
        "atmosphere": "雪、寒冷、死亡沉思",
        "scene_state": "Gabriel 在窗前沉思",
    }

    normalized = _normalize_world_state(world_state)
    assert "atmosphere" not in normalized
    assert "scene_state" not in normalized
    assert normalized["context_variables"]["atmosphere"] == "雪、寒冷、死亡沉思"
    assert normalized["context_variables"]["scene_state"] == "Gabriel 在窗前沉思"


def test_local_sentence_tokenizer_handles_chinese_punctuation():
    sentences = local_sentence_tokenize("他说：“雪停了吗？” 她没有回答。Alice saw Bob. She waved.")
    assert sentences == ["他说：“雪停了吗？”", "她没有回答。", "Alice saw Bob.", "She waved."]


if __name__ == "__main__":
    test_ontology_prompt_contains_context_variables()
    test_legacy_context_fields_are_normalized()
    test_local_sentence_tokenizer_handles_chinese_punctuation()
    print("Lightweight ontology pipeline checks passed.")
