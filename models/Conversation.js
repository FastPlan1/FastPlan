const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" }, // nom du groupe (ou vide pour une conversation privée)
    isGroup: { type: Boolean, default: false }, // true = groupe, false = privé
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
