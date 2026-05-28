import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import { handleIncomingMessage } from './handler/messageHandler';

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Meta Webhook Verification
app.get('/webhook', (req, res) => {
    const verify_token = process.env.META_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// Meta Webhook Message Receiver
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const senderId = message.from; // Phone number
                
                let textMessage = '';
                if (message.type === 'text') {
                    textMessage = message.text.body;
                }

                if (textMessage) {
                    console.log(`Received message from ${senderId}: ${textMessage}`);
                    // Process message
                    await handleIncomingMessage(senderId, textMessage);
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("Webhook Error:", error);
        res.sendStatus(500);
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected to Socket.io');
    socket.emit('status', 'connected'); // Meta API is always "connected" if webhooks work
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Meta Webhook API running on http://localhost:${PORT}`);
});
