const { db } = require("../utils/admin");
const { json } = require("express");

// get all screaams
exports.getAllscreams = async (req, res) => {
  try {
    const data = await db
      .collection("screams")
      .orderBy("createdAt", "desc")
      .get();
    let screams = [];
    data.forEach((doc) => {
      screams.push({
        screamId: doc.id,
        ...doc.data(),
      });
    });
    return res.json(screams);
  } catch (error) {
    console.error(error);
  }
};
// **************************************************

// post One screaaam
exports.postOneScream = (req, res) => {
  let {
    body: { body },
    user: { handle: userHandle, imgUrl: userImg },
  } = req;

  if (!String(body).trim())
    return res.status(400).json({ error: "body must not be empty" });

  const newScream = {
    body,
    userHandle,
    userImg,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };

  db.collection("screams")
    .add(newScream)
    .then((doc) => {
      const resScream = newScream;
      resScream.screamId = doc.id;
      res.json(resScream);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "something went wrong" });
    });
};

//********************************************************************** */

//get a specific scream with some id passed in the route parametres
exports.getScream = (req, res) => {
  let screamData = {};
  db.doc(`/screams/${req.params.ID}`)
    .get()
    .then((doc) => {
      if (!doc.exists)
        return res.status(404).json({ error: "scream not found" });
      screamData = doc.data();
      screamData.ID = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("screamId", "==", req.params.ID)
        .get();
    })
    .then((data) => {
      screamData.comments = [];
      data.forEach((doc) => screamData.comments.push(doc.data()));
      return res.json(screamData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

//**************************************************************************** */

// comment On a screaaaaaaam
exports.commentOnscream = (req, res) => {
  let {
    body: { body },
    user: { imgUrl, handle },
    params: { ID: screamId },
  } = req;

  const screamDoc = db.doc(`/screams/${screamId}`);
  let screamData = {};

  if (!String(body).trim())
    return res.status(400).json({ error: "body must not be empty" });

  const newComment = {
    screamId,
    handle,
    body,
    imgUrl,
    createdAt: new Date().toISOString(),
  };

  screamDoc
    .get()
    .then((doc) => {
      if (!doc.exists) res.status(404).json({ error: "scream not found" });
      screamData = doc.data();
      db.collection("comments").add(newComment);
      screamData.commentCount++;
      return screamDoc.update({ commentCount: screamData.commentCount });
    })
    .then(() => res.json(screamData))
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

//******************************************************************************** */

// like / unlike scream
// 1-know which operation we need to perform
// 2 - check if the scream exist
// 3- if the operation is like we make sure the the scream is not already liked
//    check if the doc in "likes" where userHandle and screamId are the same as the request properties
//        if (true) the scream is already liked
//        else add the two previous properties to "likes" collection
//            and increment likeCount in 'screams' collection
// 4-  the operation is unlike and the "likes" collection doesn't carry any doc who passes the conditions ?
//      scream cannot be unliked if its not liked
//      : delete the doc from likes collection and decrement the likeCount in 'screams' collection
exports.likeUnlikeScream = (req, res) => {
  const {
      user: { handle: userHandle },
      params: { ID: screamId },
      path,
    } = req,
    like = path.slice(-6) != "unlike",
    likeDoc = db
      .collection("likes")
      .where("userHandle", "==", userHandle)
      .where("screamId", "==", screamId)
      .limit(1),
    screamDoc = db.doc(`/screams/${screamId}`);

  let screamData = {};

  screamDoc
    .get()
    .then((doc) => {
      if (!doc.exists)
        return res.status(404).json({ error: "scream not found" });
      screamData = doc.data();
      screamData.screamId = doc.id;
      return likeDoc.get();
    })
    .then((data) =>
      data.empty && like
        ? db
            .collection("likes")
            .add({ screamId, userHandle })
            .then(() => {
              screamData.likeCount++;
              return screamDoc.update({ likeCount: screamData.likeCount });
            })
            .then(() => res.json(screamData))
            .catch((err) => res.status(500).json(err))
        : !data.empty && !like
        ? db
            .doc(`/likes/${data.docs[0].id}`)
            .delete()
            .then(() => {
              screamData.likeCount--;
              return screamDoc.update({ likeCount: screamData.likeCount });
            })
            .then(() => res.json(screamData))
            .catch((err) => res.status(500).json(err))
        : data.empty && !like
        ? res.status(500).json({ error: "scream not liked" })
        : res.status(500).json({ error: "scream Already liked" })
    )
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

//*************************************************************** */

exports.deleteScream = async (req, res) => {
  const {
    user: { handle },
    params: { screamId },
  } = req;
  const document = db.doc(`screams/${screamId}`);
  try {
    const likeDocs = await db
      .collection("likes")
      .where("screamId", "==", screamId)
      .get();
    const commentDocs = await db
      .collection("comments")
      .where("screamId", "==", screamId)
      .get();
    const doc = await document.get();
    if (!doc.exists) return res.status(404).json({ error: "scream not found" });
    if (doc.data().userHandle != handle)
      return res.status(400).json({ error: "unAuthorized" });
    likeDocs.forEach((doc) => {
      doc.ref.delete();
    });
    commentDocs.forEach((doc) => {
      doc.ref.delete();
    });
    document.delete();
    return res.json({ message: "document deleted successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "something went wrong" });
  }
};
