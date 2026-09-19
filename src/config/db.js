import dns from "dns";
import mongoose from "mongoose";

// Use public DNS servers because the local DNS resolver
// is refusing MongoDB Atlas SRV queries.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export default async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(
      `MongoDB connected: ${conn.connection.host}/${conn.connection.name}`
    );
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}