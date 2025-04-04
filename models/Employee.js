const mongoose = require("mongoose");

const EmployeeCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    used: { type: Boolean, default: false },
    patron: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EmployeeCode", EmployeeCodeSchema);
