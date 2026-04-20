# 🏦 ISO 20022 Generator & Validator

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Angular](https://img.shields.io/badge/Angular-17-DD0031?logo=angular)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)
![License](https://img.shields.io/badge/license-MIT-green.svg)

A premium, enterprise-grade suite for generating, validating, and converting ISO 20022 financial messages. Built for compliance teams, developers, and financial institutions to streamline CBPR+ and SWIFT message management.

---

## ✨ Key Features

### 🛠️ Message Generation & Manual Entry
- **19+ Supported Message Types**: Deep support for `pain`, `pacs`, and `camt` families (e.g., Pain.001, Pacs.008, Camt.053).
- **Intelligent Manual Entry**: Dynamic forms with real-time validation, business logic enforcement (CBPR+), and round-trip XML parsing.
- **Bulk Generator**: Generate high volumes of schema-valid, rule-compliant XML messages for stress testing or simulation.

### 🔍 Advanced Validation
- **Layered Validation (L1-L3)**:
  - **L1 (Syntax)**: XML structure and well-formedness.
  - **L2 (Schema)**: Strict XSD compliance.
  - **L3 (Business Rules)**: Complex cross-field validation, BIC validation, and network-specific rules.
- **Visual Error Navigator**: A professional, card-based interface with severity-coded errors and fix suggestions.

### 🔄 Conversion & Integration
- **MT to MX Converter**: Seamlessly translate legacy SWIFT MT messages into modern ISO 20022 MX equivalents.
- **BIC Reference Management**: Integrated BIC search with automated weekly dataset refreshes from global sources.
- **AI-Assisted Support**: Integrated chatbot with a specialized knowledge base for ISO 20022 documentation.

---

## 🚀 Tech Stack

### Frontend
- **Framework**: Angular 17
- **UI/UX**: Angular Material, Glassmorphism aesthetics, Custom CSS Animations
- **Persistence**: Firebase (History & Stats)
- **Deployment**: Optimized for Vercel

### Backend
- **Framework**: FastAPI (Python)
- **Validation Engine**: `lxml` with custom Python logic
- **Scheduling**: APScheduler (Weekly BIC refreshes)
- **Database**: SQLAlchemy (for local state) & Firebase (Global history)
- **AI**: OpenAI GPT-4 Integration for Chatbot

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 20+
- Python 3.10+
- Firebase Project Credentials

### Installation

#### 1. Clone & Setup Frontend
```bash
cd iso20022generatorfrontend
npm install
ng serve
```
*Access via: `http://localhost:4200`*

#### 2. Setup Backend
```bash
cd iso20022generatorbackend
pip install -r requirements.txt
python run.py
```
*API Documentation: `http://localhost:8001/docs`*

---

## 📂 Project Structure

```text
├── iso20022generatorfrontend/   # Angular Workspace
│   ├── src/app/pages/           # Dashboard, Manual Entry, Bulk Gen, etc.
│   ├── src/app/services/        # Business logic & API glue
│   └── src/assets/              # Styles & Icons
│
└── iso20022generatorbackend/    # FastAPI Application
    ├── app/services/            # MT-MX conversion & Validation engines
    ├── app/resources/rules/     # JSON-based business rule definitions
    └── app/xsds/                # Official ISO 20022 Schema files
```

---

## 🎨 Design Philosophy
The application follows a **Premium Dark/Light Hybrid** design, utilizing layered cards, subtle shadows, and high-contrast status indicators to ensure complex financial data remains legible and actionable.

---

## 📧 Support
For technical issues or schema update requests, please use the integrated **Help** section or the AI Chatbot within the application.

---
*Created with ❤️ for the Financial Industry.*
