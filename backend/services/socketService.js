const { Server } = require("socket.io");
const Notification = require("../models/Notification");

let io = null;
const userSockets = new Map(); // userId string -> socketId string

const init = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("[Socket] Client connected:", socket.id);

    socket.on("register", (userId) => {
      if (userId) {
        userSockets.set(userId.toString(), socket.id);
        console.log(`[Socket] User ${userId} registered socket ${socket.id}`);
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`[Socket] User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  return io;
};

const sendRealTimeNotification = async (userId, { title, message, type = "info" }) => {
  try {
    if (!userId) return null;

    // 1. Create notification in database
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
    });

    console.log(`[Notification] Created in DB for ${userId}: "${title}"`);

    // 2. Emit socket event if online
    if (io) {
      const socketId = userSockets.get(userId.toString());
      if (socketId) {
        io.to(socketId).emit("notification", notification);
        console.log(`[Notification] Emitted real-time socket event to user ${userId}`);
      }
    }
    return notification;
  } catch (error) {
    console.error("[Notification Error] Failed to send real-time notification:", error.message);
    return null;
  }
};

module.exports = {
  init,
  sendRealTimeNotification,
};
