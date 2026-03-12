# EcoGuard API Documentation

This directory contains the Express.js API designed for the EcoGuard software-based smart home system. It provides lightweight, event-driven tracking of electricity and water usage, coupled with a gamification and eco-tip system to foster sustainable behavior.

## Base URL
`http://localhost:3000` (or your deployed server URL)

---

## 1. Usage Logging & Analytics API
*Focused on logging events and providing interpretable summaries.*

### Log Usage Event
**POST** `/api/usage`
Logs an electricity or water consumption event. Awards the user 5 EcoPoints automatically per event as a gamification nudge.

**Request Body (JSON):**
```json
{
  "user_id": 1,               // Required
  "device_id": 2,             // Optional
  "resource_type": "electricity", // Required: "electricity" or "water"
  "amount": 2.5,              // Required: Decimal (kWh for electricity, Liters for water)
  "timestamp": "2023-11-20T10:00:00Z" // Optional, defaults to current time
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Usage logged successfully. Earned 5 EcoPoints!",
  "data": {
    "id": 10,
    "user_id": 1,
    "device_id": 2,
    "resource_type": "electricity",
    "amount": "2.50",
    "timestamp": "2023-11-20T10:00:00.000Z"
  }
}
```

### Get Usage Summary
**GET** `/api/usage/summary/:userId`
Retrieves aggregated resource usage trends over the last 7 days grouped by date, serving as an interpretable dataset for mobile chart visualization.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "resource_type": "electricity",
        "usage_date": "2023-11-20T00:00:00.000Z",
        "total_amount": "5.2"
      }
    ],
    "currentWeek": [
      {
        "resource_type": "electricity",
        "total": "45.5"
      }
    ]
  }
}
```

---

## 2. Gamification API
*Handles leaderboards, points, and achievement badges to incentivize sustainable behaviors.*

### Get Leaderboard
**GET** `/api/gamification/leaderboard`
Fetches the top 10 users ranked by total EcoPoints and streak days.

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Jane Doe",
      "points": 150,
      "streak_days": 5
    }
  ]
}
```

### Get User Gamification Status
**GET** `/api/gamification/status/:userId`
Fetches a user's total points, streaks, and all earned badges.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "Jane Doe",
      "points": 150,
      "streak_days": 5,
      "last_active_date": "2023-11-20"
    },
    "badges": [
      {
        "id": 2,
        "name": "Eco Starter",
        "description": "Logged your first resource usage.",
        "icon_url": null,
        "earned_at": "2023-11-15T12:00:00.000Z"
      }
    ]
  }
}
```

---

## 3. Eco-Tips API
*Delivers randomized contextual tips directly to the mobile UI.*

### Get Eco-Tips
**GET** `/api/tips`
Fetches up to 5 randomized eco-friendly recommendations. 

**Query Parameters:**
- `category` (optional): Filter tips by `"electricity"`, `"water"`, or `"general"`. E.g., `/api/tips?category=electricity`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Unplug Appliances",
      "description": "Vampire power can account for up to 10% of your energy bill...",
      "category": "electricity"
    }
  ]
}
```

---

## 4. User Management API
*Base EcoCred CRUD operations.*

### Get All Users
**GET** `/api/users`
**Response:** Array of user objects.

### Get User by ID
**GET** `/api/users/:id`
**Response:** Single user object.

### Create User
**POST** `/api/users`
**Request Body:** `name`, `email`, `password`

### Update User
**PUT** `/api/users/:id`
**Request Body:** `name`, `email`

### Delete User
**DELETE** `/api/users/:id`

---

## 5. Device Management API
*Base EcoCred CRUD operations.*

### Get All Devices
**GET** `/api/devices`

### Create Device
**POST** `/api/devices`
**Request Body:** `device_name`, `device_type`, `device_id`, `status` (`active`, `inactive`, etc.), `location`, `user_id`

### Update Device
**PUT** `/api/devices/:id`
**Request Body:** Any subset of fields to update

### Delete Device
**DELETE** `/api/devices/:id`
