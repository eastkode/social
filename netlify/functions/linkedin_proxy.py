import json
import os
import requests
import time

# --- Configuration ---
LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
LINKEDIN_API_BASE_URL = 'https://api.linkedin.com/rest'

# This is a simple in-memory cache. For a production app, you might want a more robust solution.
access_token_cache = {
    "token": None,
    "expires_at": 0
}

def get_linkedin_access_token():
    """
    Fetches a new LinkedIn access token using the client credentials flow.
    Caches the token to avoid re-fetching on every request.
    """
    global access_token_cache

    current_time = time.time()
    if access_token_cache['token'] and access_token_cache['expires_at'] > current_time:
        print("Using cached access token.")
        return access_token_cache['token']

    print("Fetching new LinkedIn access token...")
    client_id = os.environ.get('LINKEDIN_CLIENT_ID')
    client_secret = os.environ.get('LINKEDIN_CLIENT_SECRET')

    if not client_id or not client_secret:
        print("ERROR: LinkedIn API credentials are not set in environment variables.")
        return None

    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    data = {'grant_type': 'client_credentials', 'client_id': client_id, 'client_secret': client_secret}

    try:
        response = requests.post(LINKEDIN_TOKEN_URL, headers=headers, data=data)
        response.raise_for_status()

        token_data = response.json()
        access_token = token_data.get('access_token')
        expires_in = token_data.get('expires_in', 3600)

        access_token_cache['token'] = access_token
        access_token_cache['expires_at'] = time.time() + expires_in - 300

        print("Successfully fetched new access token.")
        return access_token

    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to get access token from LinkedIn: {e}")
        if 'response' in locals() and response is not None:
            print(f"Response body: {response.text}")
        else:
            print("No response from server")
        return None

def handler(event, context):
    """
    Netlify Function handler for proxying requests to the LinkedIn API.
    """
    # Get the access token
    access_token = get_linkedin_access_token()
    if not access_token:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Could not obtain LinkedIn access token"})
        }

    # Get the target API path from the query string
    # The full path with query params should be passed in the 'path' parameter
    target_path_and_query = event.get('queryStringParameters', {}).get('path')
    if not target_path_and_query:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Missing 'path' query parameter"})
        }

    target_url = f"{LINKEDIN_API_BASE_URL}{target_path_and_query}"
    print(f"Proxying request to: {target_url}")

    # Make the request to the LinkedIn API
    headers = {
        'Authorization': f'Bearer {access_token}',
        'LinkedIn-Version': '202405'
    }

    try:
        response = requests.get(target_url, headers=headers)

        # Return the response from the LinkedIn API
        return {
            "statusCode": response.status_code,
            "headers": {
                "Content-Type": "application/json"
            },
            "body": response.text
        }

    except requests.exceptions.RequestException as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Failed to proxy request to LinkedIn: {e}"})
        }
