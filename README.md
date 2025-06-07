# Blockchain-Based Voting System

This project is a decentralized voting system built using Ethereum smart contracts, Truffle, and a web frontend. It allows secure and transparent elections using blockchain technology.

---

## ✅ Prerequisites

Ensure you have the following installed on your system:

* [Node.js & npm](https://nodejs.org/)
* [Truffle](https://trufflesuite.com/docs/truffle/quickstart/)

  ```bash
  npm install -g truffle
  ```
* [Ganache](https://trufflesuite.com/ganache/)
* [MetaMask Browser Extension](https://metamask.io/)

---

## 🚀 Getting Started

### Step 1: Extract and Open the Project

1. Extract the ZIP file of the project.
2. Open a terminal and navigate to the project folder:

```bash
cd path/to/blockchain_based_voting_system
```

---

### Step 2: Install Dependencies

Install all required packages using:

```bash
npm install
```

---

### Step 3: Compile Smart Contracts

Use Truffle to compile the smart contracts:

```bash
truffle compile
```

---

### Step 4: Start Ganache

* Launch Ganache.
* Make sure it is running at:

```
http://127.0.0.1:7545
```

---

### Step 5: Deploy Smart Contracts

Deploy the smart contracts to the local blockchain:

```bash
truffle migrate --reset
```

---

### Step 6: Start the Frontend

Run the frontend locally:

```bash
npm run dev
```

Then open the app in your browser, usually at:

```
http://localhost:3000
```

---

## 📌 Notes

* Make sure MetaMask is connected to the **local Ganache network**.
* Use the same accounts listed in Ganache for testing.

---

## 🛠️ Project Structure

* `contracts/` – Solidity smart contracts
* `migrations/` – Deployment scripts
* `src/` – Frontend code (HTML/JS/CSS)
* `truffle-config.js` – Truffle configuration

---


