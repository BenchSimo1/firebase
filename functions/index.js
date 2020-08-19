const functions = require("firebase-functions");

const express = require("express");
const app = express();
const morgan = require("morgan");

app.use(morgan("dev"));

const {
  getAllscreams,
  postOneScream,
  getScream,
  commentOnscream,
  likeUnlikeScream,
  deleteScream,
} = require("./handlers/screams");

const {
  signup,
  login,
  upload,
  addUserDetails,
  getOwnUserDetails,
} = require("./handlers/users");
const { FBauth } = require("./middleware/FBauth");

// scream routes
app.get("/screams", getAllscreams);
app.post("/scream", FBauth, postOneScream);
app.get("/scream/:ID", getScream);
app.post("/scream/comment/:ID", FBauth, commentOnscream);
app.get("/scream/like/:ID", FBauth, likeUnlikeScream);
app.get("/scream/unlike/:ID", FBauth, likeUnlikeScream);
app.delete("/scream/:screamId", FBauth, deleteScream);

//user routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBauth, upload);
app.post("/user", FBauth, addUserDetails);
app.get("/user", FBauth, getOwnUserDetails);

exports.api = functions.region("europe-west1").https.onRequest(app);
