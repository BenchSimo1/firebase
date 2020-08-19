const admin = require("firebase-admin");
admin.initializeApp();

exports.db = admin.firestore();
exports.admin = admin;
