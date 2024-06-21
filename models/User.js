const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  searchHistory: { type: Array, default: [] } // Added search history field
});

module.exports = mongoose.model('User', userSchema);
