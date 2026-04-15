
# Naseej Socket.IO Server

Real-time WebSocket server for the Naseej marketplace platform.

## Overview

This service handles real-time communication between users of the Naseej platform, enabling instant messaging, typing indicators, read receipts, and online status updates.

## Purpose

The server acts as a dedicated real-time communication layer, separate from the main backend API, to ensure:

- Instant message delivery without page refresh
- Reduced load on the main backend server
- Scalable real-time features
- Better user experience

## Features

- 🔌 Real-time WebSocket connections
- 📨 Instant message delivery
- ⌨️ Typing indicators
- 👁️ Read receipts
- 🟢 Online/offline status
- 🔐 Secure authentication
- 🏥 Health monitoring

## Technical Architecture

The service operates as an independent WebSocket server that:

1. Authenticates users via token validation against the main backend
2. Maintains persistent connections for real-time communication
3. Routes messages between connected users in real-time
4. Persists all messages to the main database
5. Broadcasts typing and read status updates

## Communication Flow

- Users establish a WebSocket connection upon login
- Messages are sent through the WebSocket and saved to the database
- Recipients receive messages instantly without polling
- Typing indicators show when someone is composing a message
- Read receipts confirm when messages are viewed

## Deployment

This service is deployed as an independent container and communicates with the main Naseej backend API.

## Related Services

- Naseej Main Backend - REST API and database operations
- Naseej Frontend - User interface

## Security

- All connections require valid authentication tokens
- Messages are only delivered to intended recipients
- No message data is stored on this server (persists to main database)

## License

ISC