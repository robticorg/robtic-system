# Robtic System

Robtic System is a modular Discord automation platform designed for developer communities.
It provides a scalable bot ecosystem where multiple specialized bots operate under a single main controller.

## Overview

The system is built to manage community operations, staff workflows, moderation, and service access in a structured and automated way.

A central **Main Bot** controls and coordinates several functional bots, allowing administrators to enable or disable modules as needed.

## Core Components

* **Main Bot** – system controller, configuration manager, advertisement system, and partner server management
* **Ticket Bot** – ticket and support management
* **Moderation Bot** – moderation tools and punishment logging
* **HR Bot** – staff management, recruitment, and promotions
* **ModMail Bot** – private communication between users and staff
* **Community Bot** – XP, activity tracking, and progression roles
* **Dev Bot** – development and testing

## Key Features

* Modular bot architecture
* Centralized system control
* Ticket and modmail systems
* Staff management automation
* Activity and role progression system
* Advertisement ordering and management
* Partner server tracking with automatic role re-grant on rejoin
* Structured moderation logging

## Technology

* Bun
* TypeScript
* Discord.js v14
* Environment-based configuration

## Configuration

All bot tokens and system configuration are defined in the `.env` file.

## Purpose

Robtic System aims to provide a reliable automation backbone for developer-focused communities and services.

..