# Additional unit tests for is_resolved function

import pytest
from app.services.simulator_state import is_resolved


def test_is_resolved_escalation_condition_true():
    """is_resolved should be False if escalation_intent >= 85 even if other conditions met"""
    state = {
        "satisfaction": 80,
        "frustration": 20,
        "escalation_intent": 85,
    }
    assert is_resolved(state) is False, "Escalation intent >=85 should prevent resolution"


def test_is_resolved_escalation_condition_false():
    """is_resolved should be True when escalation_intent < 85 and other conditions met"""
    state = {
        "satisfaction": 90,
        "frustration": 10,
        "escalation_intent": 84,
    }
    assert is_resolved(state) is True, "Escalation intent <85 with good metrics should be resolved"


def test_is_resolved_missing_fields():
    """Missing fields should result in False resolution"""
    # Only satisfaction provided
    state = {"satisfaction": 80}
    assert is_resolved(state) is False, "Missing frustration and escalation_intent should be False"
    # Only frustration provided
    state = {"frustration": 10}
    assert is_resolved(state) is False, "Missing satisfaction and escalation_intent should be False"
    # No fields
    assert is_resolved({}) is False, "Empty state should be False"
