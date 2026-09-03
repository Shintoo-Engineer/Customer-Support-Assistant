"""Scenario service providing support scenario templates and resolution conditions."""

SCENARIOS = {
    "refund": {
        "opening_complaint": (
            "Hi, I was charged $49.99 for a subscription renewal that I requested to cancel "
            "last week. I need a full refund issued back to my card immediately."
        ),
        "key_facts": [
            "Order/Invoice ID: #INV-49201",
            "Charged Amount: $49.99 on original payment card",
            "Cancellation Request Date: 5 days prior to billing cycle renewal",
            "Eligibility Window: Within 30-day refund grace policy"
        ],
        "resolution_condition": (
            "The agent confirms the customer's eligibility, initiates the full refund "
            "transaction of $49.99, and clearly explains the 3-5 business day processing timeline."
        )
    },
    "delayed_order": {
        "opening_complaint": (
            "My order #ORD-78219 was scheduled for guaranteed delivery 3 days ago, but the "
            "tracking hasn't updated and the package still hasn't arrived. Where is my item?"
        ),
        "key_facts": [
            "Order Number: #ORD-78219",
            "Promised Delivery Window: 3 days past delivery SLA",
            "Courier Status: Stuck in transit / carrier exception",
            "Item Value: $120.00"
        ],
        "resolution_condition": (
            "The agent acknowledges the shipping delay, checks tracking status, offers either "
            "an expedited replacement or shipping fee waiver/credit, and provides clear tracking updates."
        )
    },
    "payment_failure": {
        "opening_complaint": (
            "I'm trying to upgrade my team's subscription plan, but my credit card keeps getting "
            "declined with error code ERR_PAYMENT_FAILED_04 even though my funds are sufficient."
        ),
        "key_facts": [
            "Error Code: ERR_PAYMENT_FAILED_04 (3D-Secure authentication timeout)",
            "Target Plan: Annual Pro Tier ($299/yr)",
            "Card Type: Visa ending in 4242",
            "Failed Attempts: 3 consecutive transaction attempts"
        ],
        "resolution_condition": (
            "The agent identifies the payment gateway verification issue, guides the customer "
            "through the alternate payment link or 3DS verification steps, and confirms successful transaction completion."
        )
    },
    "account_issue": {
        "opening_complaint": (
            "I've been locked out of my corporate account after losing access to my two-factor "
            "authentication device, and I need access restored urgently."
        ),
        "key_facts": [
            "Account Email: user@company.com",
            "Lockout Reason: Lost 2FA authenticator app on device change",
            "Last Successful Login: 2 days ago",
            "Verification Option: Registered backup security email on file"
        ],
        "resolution_condition": (
            "The agent follows security verification protocols, verifies the customer's identity "
            "via the registered backup email magic link or one-time code, and safely restores account access."
        )
    },
    "cancellation": {
        "opening_complaint": (
            "I would like to cancel my current monthly subscription immediately and ensure "
            "auto-renewal is turned off so I am not billed again."
        ),
        "key_facts": [
            "Subscription Tier: Monthly Business Plan ($29/mo)",
            "Account ID: #ACC-88310",
            "Next Billing Date: In 4 days",
            "Usage Status: Active for 6 months"
        ],
        "resolution_condition": (
            "The agent acknowledges the cancellation request, informs the customer of retention "
            "options or billing period end date without undue pressure, confirms cancellation, and ensures no future charges."
        )
    }
}


def get_scenario_brief(scenario_type: str) -> str:
    """Returns a formatted plain-text paragraph describing the support scenario.

    Args:
        scenario_type: The type of scenario (refund, delayed_order, payment_failure,
          account_issue, cancellation).

    Returns:
        Formatted string ready for inclusion in LLM prompts.

    Raises:
        ValueError: If scenario_type is not one of the supported scenarios.
    """
    key = scenario_type.strip().lower()
    if key not in SCENARIOS:
        valid_scenarios = ", ".join(sorted(SCENARIOS.keys()))
        raise ValueError(
            f"Invalid scenario type '{scenario_type}'. Must be one of: {valid_scenarios}"
        )

    scenario = SCENARIOS[key]
    key_facts_text = "\n".join(f"- {fact}" for fact in scenario["key_facts"])

    return (
        f"Scenario Type: {key.replace('_', ' ').title()}\n"
        f"Opening Complaint: \"{scenario['opening_complaint']}\"\n"
        f"Key Facts:\n{key_facts_text}\n"
        f"Resolution Condition: {scenario['resolution_condition']}"
    )
