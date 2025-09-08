import re
from playwright.sync_api import Page, expect, sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the local server URL
    page.goto('http://localhost:8080/index.html')

    # Wait for the data to be loaded by checking the refresh status message
    expect(page.locator("#refresh-status")).to_contain_text("Data loaded", timeout=30000)

    # Take a screenshot of the initial "All Platforms" view
    page.screenshot(path="jules-scratch/verification/all_platforms.png", full_page=True)

    # Filter for Instagram
    page.get_by_label("Platform").select_option("instagram")
    page.get_by_role("button", name="Apply").click()
    expect(page.get_by_role("heading", name="Instagram KPIs")).to_be_visible(timeout=10000)
    page.screenshot(path="jules-scratch/verification/instagram_view.png", full_page=True)

    # Filter for LinkedIn
    page.get_by_label("Platform").select_option("linkedin")
    page.get_by_role("button", name="Apply").click()
    expect(page.get_by_role("heading", name="LinkedIn KPIs")).to_be_visible(timeout=10000)
    page.screenshot(path="jules-scratch/verification/linkedin_view.png", full_page=True)

    # ---
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
