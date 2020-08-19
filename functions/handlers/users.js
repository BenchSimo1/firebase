const firebaseConfig = require("../utils/config");
const firebase = require("firebase");
firebase.initializeApp(firebaseConfig);
const { db, admin } = require("../utils/admin");

exports.signup = (req, res) => {
  let token, uid;
  let { email, handle, password, passwordconfirm } = req.body;
  const newUser = {
    email,
    password,
    passwordconfirm,
    handle,
  };

  let errors = {};

  for (let property in newUser) {
    if (!String(newUser[property]).trim())
      errors[property] = `${property} Must not be empty`;
    else {
      if (
        (property == "email" &&
          !/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/.test(
            email
          )) ||
        (property == "password" && !/^[^\s+]\S{6,}[^\s+]$/.test(password)) ||
        (property == "passwordconfirm" && passwordconfirm != password) ||
        (property == "handle" && !/(^[^\d+]).{6,}\d*$/.test(handle))
      )
        errors[property] = `${property} must be valid`;
    }
  }

  if (Object.keys(errors).length) return res.status(400).json({ errors });

  db.doc(`/users/${handle}`)
    .get()
    .then((doc) =>
      doc.exists
        ? res.status(400).json({ handle: "this handle is already taken" })
        : firebase.auth().createUserWithEmailAndPassword(email, password)
    )
    .then((data) => {
      uid = data.user.uid;
      return data.user.getIdToken();
    })
    .then((tokenId) => {
      token = tokenId;
      const userCredentials = {
        handle,
        email,
        uid,
        imgUrl: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/blank-profile-picture-973460_1280.png?alt=media`,
        createdAt: new Date().toISOString(),
      };
      return db.doc(`/users/${handle}`).set(userCredentials);
    })
    .then(() => res.status(201).json({ token }))
    .catch((err) => {
      console.error(err);
      return err.code != "auth/email-already-in-use"
        ? res.status(500).json({ error: err.code })
        : res.status(400).json({ email: "email is already in use" });
    });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  const user = { email, password };
  let errors = {};
  for (let property in user) {
    if (!String(user[property]).trim())
      errors[property] = `${property} Must not be empty`;
  }

  if (Object.keys(errors).length) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .then((data) => data.user.getIdToken())
    .then((token) => res.status(201).json({ token }))
    .catch((err) => {
      console.error(err);
      return err.code == "auth/wrong-password"
        ? res
          .status(403)
          .json({ general: "wrong credentials please try again " })
        : res.status(500).json({ error: err.code });
    });
};

exports.upload = (req, res) => {
  const Busboy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new Busboy({ headers: req.headers });
  let imgFileName;
  let imgToUpload = {};
  busboy.on("file", (l, file, filename, _, mimetype) => {
    if (!/jpeg|png/.test(mimetype))
      return res.status(400).json({ error: "wrong file type submitted" });

    imgFileName = filename;
    const filePath = path.join(os.tmpdir(), imgFileName);
    imgToUpload = { filePath, mimetype };
    file.pipe(fs.createWriteStream(filePath));
  });

  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imgToUpload.filePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imgToUpload.mimetype,
          },
        },
      })
      .then(() => {
        imgUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imgFileName}?alt=media`;
        return db.doc(`/users/${req.user.handle}`).update({ imgUrl });
      })
      .then(() =>
        res.status(201).json({ message: "image uploaded successfully" })
      )
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });

  busboy.end(req.rawBody);
};

exports.addUserDetails = (req, res) => {
  const { bio, website, location } = req.body;
  const userDetails = { bio, website, location };
  for (let property in userDetails) {
    if (!String(userDetails[property]).trim()) {
      delete userDetails[property];
    } else if (
      property == "website" &&
      !/^(?=https?:\/\/)/.test(userDetails[property])
    ) {
      userDetails.website = `http://${userDetails.website}`;
    }
  }

  db.doc(`/users/${req.user.handle}`)
    .update(userDetails)
    .then(() => res.json({ message: "user details added successfully" }))
    .catch((err) => res.status(500).json({ error: err.code }));
};

exports.getOwnUserDetails = (req, res) => {
  const userData = {},
    { handle } = req.user;
  db.doc(`users/${handle}`)
    .get()
    .then((doc) => {
      doc.exists ? (userData.credentials = doc.data()) : "";
      return db.collection("likes").where("userHandle", "==", handle).get();
    })
    .then((data) => {
      userData.likes = [];
      data.forEach((doc) => userData.likes.push(doc.data()));
      return res.json(userData);
    })
    .catch((err) => console.error(err));
};
