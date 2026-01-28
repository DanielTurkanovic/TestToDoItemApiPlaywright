Feature: ToDo Item Management with Gherkin
  As an authenticated user
  I want to manage my ToDo items using BDD approach
  So that I can verify API functionality with business-readable tests

  Scenario: Create and verify a new ToDo item
    Given I am an authenticated user
    When I create a new ToDo item with title "Learn Playwright" and description "Study testing framework"
    Then the item should be created successfully
    And I should be able to find it in my ToDo list

  Scenario: Update an existing ToDo item
    Given I have an existing ToDo item
    When I update the item title to "Master Playwright" and mark it as completed
    Then the item should be updated successfully
    And the changes should be reflected in the system

  Scenario: Search for ToDo items
    Given I have multiple ToDo items
    When I search for items with term "Playwright"
    Then I should see relevant search results

  Scenario: Get specific ToDo item
    Given I have an existing ToDo item
    When I get the item by ID
    Then the response status should be 200
    And the item should have title "Test Item for Gherkin"

  Scenario: Create item with special characters
    Given I am an authenticated user
    When I create a new ToDo item with title "Test @#$%^&*()" and description "Special chars !@#$%"
    Then the item should be created successfully