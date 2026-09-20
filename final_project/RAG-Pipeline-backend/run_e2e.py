import requests
import json

BASE_URL = 'http://127.0.0.1:8000'

def run_tests():
    print('==================================================')
    print('TEST CASE 1: The Angry Escalation (Unhappy Path)')
    print('Purpose: Proves Task 3 emotion tracking, Task 4 intent/emotion detection, and the dynamic patience formula.')
    print('==================================================')
    res1 = requests.post(f'{BASE_URL}/simulator/start', json={
        'session_label': 'Test Case 1',
        'persona': 'angry',
        'initial_emotion': 'angry',
        'scenario': 'refund',
        'expected_resolution': 'Full refund issued',
        'patience_level': 1,
        'issue_severity': 5
    }).json()
    sess1 = res1['session_id']
    print(f'-> [Customer Opening]: {res1["customer_message"]}')
    agent_resp1 = 'Look, there is nothing I can do. Read the terms of service, no refunds.'
    print(f'-> [Agent Response]: {agent_resp1}')
    turn1 = requests.post(f'{BASE_URL}/support/turn', json={'session_id': sess1, 'agent_response': agent_resp1}).json()
    print('-> [Exact Backend Output]:')
    print(json.dumps({
        'Next_Customer_Message': turn1.get('customer_message'),
        'State': turn1.get('state'),
        'Is_Escalated': turn1.get('is_escalated'),
        'Analysis (Task 4)': {'emotion': turn1.get('analysis', {}).get('emotion'), 'intent': turn1.get('analysis', {}).get('intent')},
        'RAG_Top_Document (Task 5)': turn1.get('recommendations', [{}])[0].get('title') if turn1.get('recommendations') else 'None'
    }, indent=2))
    print('\n')

    print('==================================================')
    print('TEST CASE 2: The Polite Resolution (Happy Path)')
    print('Purpose: Proves positive resolution mechanics, correct delivery intent matching, and empathy recognition.')
    print('==================================================')
    res2 = requests.post(f'{BASE_URL}/simulator/start', json={
        'session_label': 'Test Case 2',
        'persona': 'polite',
        'initial_emotion': 'calm',
        'scenario': 'delayed_order',
        'expected_resolution': 'Order tracked and expedited',
        'patience_level': 4,
        'issue_severity': 3
    }).json()
    sess2 = res2['session_id']
    print(f'-> [Customer Opening]: {res2["customer_message"]}')
    agent_resp2 = 'I sincerely apologize for the delay. I have expedited your shipping and issued a 20% refund for the inconvenience. It will arrive tomorrow.'
    print(f'-> [Agent Response]: {agent_resp2}')
    turn2 = requests.post(f'{BASE_URL}/support/turn', json={'session_id': sess2, 'agent_response': agent_resp2}).json()
    print('-> [Exact Backend Output]:')
    print(json.dumps({
        'Next_Customer_Message': turn2.get('customer_message'),
        'State': turn2.get('state'),
        'Is_Resolved': turn2.get('is_resolved'),
        'Analysis (Task 4)': {'emotion': turn2.get('analysis', {}).get('emotion'), 'intent': turn2.get('analysis', {}).get('intent')},
        'RAG_Top_Document (Task 5)': turn2.get('recommendations', [{}])[0].get('title') if turn2.get('recommendations') else 'None'
    }, indent=2))
    print('\n')

    print('==================================================')
    print('TEST CASE 3: The Strict Guardrail (Out of Domain)')
    print('Purpose: Proves Task 5 strictly filters out irrelevant knowledge and prevents AI hallucination for off-topic queries.')
    print('==================================================')
    ood_query = 'Can you tell me the weather forecast for tomorrow and give me a recipe for pancakes?'
    print(f'-> [Customer Query]: {ood_query}')
    rag_res = requests.post(f'{BASE_URL}/knowledge/recommend', json={'query': ood_query}).json()
    print('-> [Exact Backend Output]:')
    print(json.dumps({
        'no_relevant_information': rag_res.get('no_relevant_information'),
        'recommendations_count': len(rag_res.get('recommendations', [])),
        'fallback_action': 'System safely rejects query instead of hallucinating.' if rag_res.get('no_relevant_information') else 'Failed'
    }, indent=2))

if __name__ == '__main__':
    run_tests()
