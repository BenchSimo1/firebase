const { admin, db } = require("../utils/admin");

exports.FBauth = (req, res, next) => {
  const { authorization } = req.headers;
  const idToken =
    authorization && authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
  if (!idToken) {
    console.error("no Token Found");
    return res.status(403).json({ error: "Unauthorized" });
  }

  admin
    .auth()
    .verifyIdToken(idToken)
    .then((decodedToken) => {
      req.user = decodedToken;
      return db
        .collection("users")
        .where("uid", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then((data) => {
      req.user.handle = data.docs[0].data().handle;
      req.user.imgUrl = data.docs[0].data().imgUrl;
      return next();
    })
    .catch((err) => {
      console.error("error while verifyinfg token", err);
      return res.status(403).json(err);
    });
};
