from app.services.analysis_service import (
    analyze_customer_message,
    detect_intent,
    detect_emotion,
    detect_sentiment,
    calculate_frustration,
    determine_satisfaction_trend,
    detect_escalation_risk,
)


def test_refund_intent():
    result = analyze_customer_message(
        "Where is my refund? It has not arrived yet."
    )
    assert result["intent"] == "refund_status"


def test_cancellation_intent():
    result = analyze_customer_message(
        "I want to cancel my order."
    )
    assert result["intent"] == "cancellation"


def test_delivery_intent():
    result = analyze_customer_message(
        "My package is delayed and the tracking has not changed."
    )
    assert result["intent"] == "delivery_issue"


def test_payment_intent():
    result = analyze_customer_message(
        "My payment failed when I tried to place the order."
    )
    assert result["intent"] == "payment_issue"


def test_account_intent():
    result = analyze_customer_message(
        "I cannot log in to my account."
    )
    assert result["intent"] == "account_issue"


def test_complaint_intent():
    result = analyze_customer_message(
        "I want to make a complaint about this terrible service."
    )
    assert result["intent"] == "complaint"


def test_return_exchange_intent():
    result = analyze_customer_message(
        "The item is damaged and I want a replacement."
    )
    assert result["intent"] == "return_exchange"


def test_general_inquiry():
    result = analyze_customer_message(
        "Can you tell me how this service works?"
    )
    assert result["intent"] == "general_inquiry"


def test_happy_emotion():
    assert detect_emotion(
        "That is great, thank you so much!"
    ) == "happy"


def test_confused_emotion():
    assert detect_emotion(
        "I am confused. I don't understand what this means."
    ) == "confused"


def test_worried_emotion():
    assert detect_emotion(
        "I am worried that my payment has been lost."
    ) == "worried"


def test_frustrated_emotion():
    assert detect_emotion(
        "I am frustrated because I have already explained this."
    ) == "frustrated"


def test_angry_emotion():
    assert detect_emotion(
        "This is unacceptable. Get me your manager right now!"
    ) == "angry"


def test_positive_sentiment():
    assert detect_sentiment(
        "Thank you, that was very helpful."
    ) == "Positive"


def test_negative_sentiment():
    assert detect_sentiment(
        "This service is terrible and I am very disappointed."
    ) == "Negative"


def test_neutral_sentiment():
    assert detect_sentiment(
        "Where can I find my order reference?"
    ) == "Neutral"


def test_high_frustration():
    score = calculate_frustration(
        "I am extremely frustrated. I already told you twice. "
        "This is ridiculous. Get me your manager now!"
    )
    assert score >= 7


def test_low_frustration():
    score = calculate_frustration(
        "Could you please tell me the status of my order?"
    )
    assert score <= 3


def test_declining_satisfaction():
    history = [
        {
            "sender_type": "Customer",
            "message_text": "I would like to know my refund status."
        },
        {
            "sender_type": "Support Agent",
            "message_text": "Let me check that for you."
        },
    ]

    result = determine_satisfaction_trend(
        "This is still not resolved and I am frustrated.",
        history,
    )

    assert result == "Declining"


def test_improving_satisfaction():
    history = [
        {
            "sender_type": "Customer",
            "message_text": "I am frustrated because this is still pending."
        },
        {
            "sender_type": "Support Agent",
            "message_text": "I have processed the refund."
        },
    ]

    result = determine_satisfaction_trend(
        "Thank you, that helps a lot.",
        history,
    )

    assert result == "Improving"


def test_low_escalation_risk():
    risk = detect_escalation_risk(
        frustration_level=2,
        message="Could you please help me check my order?",
    )

    assert risk == "Low"


def test_medium_escalation_risk():
    risk = detect_escalation_risk(
        frustration_level=6,
        message="I am getting frustrated. Can you please help?",
    )

    assert risk == "Medium"


def test_high_escalation_risk():
    risk = detect_escalation_risk(
        frustration_level=9,
        message="This is unacceptable. I will take legal action.",
    )

    assert risk == "High"


def test_full_analysis_structure():
    result = analyze_customer_message(
        "I have already explained this twice. Where is my refund?"
    )

    expected_keys = {
        "intent",
        "emotion",
        "sentiment",
        "frustration_level",
        "satisfaction_trend",
        "escalation_risk",
        "confidence",
    }

    assert expected_keys.issubset(result.keys())

    assert 0 <= result["frustration_level"] <= 10
    assert 0 <= result["confidence"] <= 1