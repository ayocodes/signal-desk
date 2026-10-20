from agent import config


def test_shared_files_load_with_the_documented_weights() -> None:
    s = config.scoring()
    assert s.threshold == 50
    assert (s.icp.full, s.icp.partial) == (40, 20)
    assert s.signals.hiring_sales == 30
    assert [step.max_hours for step in s.freshness] == sorted(step.max_hours for step in s.freshness)
    assert s.partial_rules.team_size_max > s.icp_rules.team_size_max


def test_keyword_and_guardrail_files_load() -> None:
    assert "sales" in config.hiring_keywords().categories
    g = config.guardrails()
    assert g.mailbox.daily_cap > 0
    assert 0 <= g.test_inboxes.bounced_per_100 + g.test_inboxes.complained_per_100 < 100
