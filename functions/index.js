/* eslint-disable max-len */
/**
import { in } from './../node_modules/jest-mock/build/index';
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const logger = require("firebase-functions/logger");
// eslint-disable-next-line max-len
const {onDocumentCreated, onDocumentDeleted, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {Filter} = require("firebase-admin/firestore");
const functions = require("firebase-functions");
const jwt = require("jsonwebtoken");

admin.initializeApp();
setGlobalOptions({maxInstances: 10});
const firestore = admin.firestore();
const apiUrl = "https://onesignal.com/api/v1/notifications";
const apiKey = "MzU1MGRmMTctMTFjZC00ZDFjLTg4NDQtZjc1NDljODRhNDhl";
const appId = "e4027807-c701-4d05-8712-0246cdbbc0d8";

// eslint-disable-next-line max-len
exports.addTokenField = onDocumentCreated("/fimaers/{documentId}", (event) => {
  const uid = event.data.data().uid;
  logger.log("Uppercasing", event.params.documentId, uid);
  const apiKeySid = "SK.0.s58TZ2pInB00WV2VfNT5EtfSlKCh7s";
  const apiKeySecret = "eTF0U1FpVXd3dW1Ka01pVzQ1ZnhrQUk5WkVpMXBCOA==";
  const userId = uid;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7776000;
  const header = {cty: "stringee-api;v=1"};
  const payload = {
    jti: apiKeySid + "-" + now,
    iss: apiKeySid,
    exp: exp,
    userId: userId,
  };
  const token = jwt
      .sign(payload, apiKeySecret, {algorithm: "HS256", header: header});
  return event.data.ref.set({token}, {merge: true});
});

exports.refreshToken = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth || !context.auth.uid) {
    // eslint-disable-next-line max-len
    throw new functions.https.HttpsError("unauthenticated", "User not authenticated.");
  }

  const uid = context.auth.uid;
  logger.info("it's work?" + uid);
  const apiKeySid = "SK.0.s58TZ2pInB00WV2VfNT5EtfSlKCh7s";
  const apiKeySecret = "eTF0U1FpVXd3dW1Ka01pVzQ1ZnhrQUk5WkVpMXBCOA==";

  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7776000;
    const header = {cty: "stringee-api;v=1"};
    const payload = {
      jti: apiKeySid + "-" + now,
      iss: apiKeySid,
      exp: exp,
      userId: uid,
    };
    const token = jwt
        .sign(payload, apiKeySecret, {algorithm: "HS256", header: header});

    await admin.firestore().collection("fimaers").doc(uid).update({token});
    logger.info("it's work?", token);

    return token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    // eslint-disable-next-line max-len
    throw new functions.https.HttpsError("internal", "An error occurred while refreshing the token.");
  }
});


// eslint-disable-next-line max-len
exports.randomCallsPairing = onDocumentCreated("/calls_queue/{documentId}", async (event) => {
  const senderUid = event.data.data().uid;
  const genderMatch = event.data.data().genderMatch;
  const minAgeMatch = event.data.data().minAgeMatch;
  const maxAgeMatch = event.data.data().maxAgeMatch;
  const gender = event.data.data().gender;
  const age = event.data.data().age;
  try {
    logger.info("it's work?", gender, genderMatch);
    const callsQueueRef = firestore.collection("calls_queue");
    const callsRef = firestore.collection("calls");
    let callsQueueSnapshot;
    if (genderMatch !== "both") {
      // callsQueueSnapshot = await callsQueueRef

      //     .where("gender", "==", preferGender)
      //     .where("preferGender", "not-in", [!gender])
      //     .limit(1).get();
      const genderMatchBolean = (genderMatch === "male");
      callsQueueSnapshot = await callsQueueRef
          .where("uid", "!=", senderUid)
          .where(
              Filter.or(
                  Filter.where("genderMatch", "==", "both"),
                  Filter.where("genderMatch", "==", gender ? "male" : "female"),
              ),
          )
          .where("gender", "==", genderMatchBolean)
          .get();
      logger.info("it's work?", senderUid, callsQueueSnapshot.size);
    } else {
      callsQueueSnapshot = await callsQueueRef
          .where("uid", "!=", senderUid)
          .where(
              Filter.or(
                  Filter.where("genderMatch", "==", "both"),
                  Filter.where("genderMatch", "==", gender ? "male" : "female"),
              ),
          )
          .get();
      logger.info("it's work?", senderUid, callsQueueSnapshot.size);
    }
    // eslint-disable-next-line max-len

    const matchingDocuments = callsQueueSnapshot.docs.filter((doc) => {
      const matchAge = doc.data().age;
      const matchMinAgeMatch = doc.data().minAgeMatch;
      const matchMaxAgeMatch = doc.data().maxAgeMatch;
      const isAgeMatch =
      age >= matchMinAgeMatch &&
      age <= matchMaxAgeMatch &&
      matchAge >= minAgeMatch &&
      matchAge <= maxAgeMatch;
      // eslint-disable-next-line max-len
      logger.info(doc.data(), minAgeMatch, maxAgeMatch, age,
          age >= matchMinAgeMatch, age <= matchMaxAgeMatch,
          matchAge >= minAgeMatch, matchAge <= maxAgeMatch, isAgeMatch);

      return isAgeMatch;
    });
    logger.info(matchingDocuments.length);

    if (matchingDocuments.length > 0) {
      logger.info(matchingDocuments[0].data());
      const receiverUid = matchingDocuments[0].data().uid;
      logger.info("yes sir", senderUid, receiverUid);
      await callsRef.add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        participantIDs: [senderUid, receiverUid],
      });
      await callsQueueRef.doc(senderUid).delete();
      await callsQueueRef.doc(receiverUid).delete();
    }
    // Return a successful response
    return null;
  } catch (error) {
    logger.error("Error:", error);
    // Return an error response
    throw new Error("An error occurred.");
  }
});

// eslint-disable-next-line max-len
exports.randomVideosPairing = onDocumentCreated("/videos_queue/{documentId}", async (event) => {
  const senderUid = event.data.data().uid;
  const genderMatch = event.data.data().genderMatch;
  const minAgeMatch = event.data.data().minAgeMatch;
  const maxAgeMatch = event.data.data().maxAgeMatch;
  const gender = event.data.data().gender;
  const age = event.data.data().age;
  try {
    logger.info("it's work?", gender, genderMatch);
    const callsQueueRef = firestore.collection("videos_queue");
    const callsRef = firestore.collection("videos");
    let callsQueueSnapshot;
    if (genderMatch !== "both") {
      // callsQueueSnapshot = await callsQueueRef

      //     .where("gender", "==", preferGender)
      //     .where("preferGender", "not-in", [!gender])
      //     .limit(1).get();
      const genderMatchBolean = (genderMatch === "male");
      callsQueueSnapshot = await callsQueueRef
          .where("uid", "!=", senderUid)
          .where(
              Filter.or(
                  Filter.where("genderMatch", "==", "both"),
                  Filter.where("genderMatch", "==", gender ? "male" : "female"),
              ),
          )
          .where("gender", "==", genderMatchBolean)
          .get();
      logger.info("it's work?", senderUid, callsQueueSnapshot.size);
    } else {
      callsQueueSnapshot = await callsQueueRef
          .where("uid", "!=", senderUid)
          .where(
              Filter.or(
                  Filter.where("genderMatch", "==", "both"),
                  Filter.where("genderMatch", "==", gender ? "male" : "female"),
              ),
          )
          .get();
      logger.info("it's work?", senderUid, callsQueueSnapshot.size);
    }
    // eslint-disable-next-line max-len

    const matchingDocuments = callsQueueSnapshot.docs.filter((doc) => {
      const matchAge = doc.data().age;
      const matchMinAgeMatch = doc.data().minAgeMatch;
      const matchMaxAgeMatch = doc.data().maxAgeMatch;
      const isAgeMatch =
      age >= matchMinAgeMatch &&
      age <= matchMaxAgeMatch &&
      matchAge >= minAgeMatch &&
      matchAge <= maxAgeMatch;
      // eslint-disable-next-line max-len
      logger.info(doc.data(), minAgeMatch, maxAgeMatch, age,
          age >= matchMinAgeMatch, age <= matchMaxAgeMatch,
          matchAge >= minAgeMatch, matchAge <= maxAgeMatch, isAgeMatch);

      return isAgeMatch;
    });
    logger.info(matchingDocuments.length);

    if (matchingDocuments.length > 0) {
      logger.info(matchingDocuments[0].data());
      const receiverUid = matchingDocuments[0].data().uid;
      logger.info("yes sir", senderUid, receiverUid);
      await callsRef.add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        participantIDs: [senderUid, receiverUid],
      });
      await callsQueueRef.doc(senderUid).delete();
      await callsQueueRef.doc(receiverUid).delete();
    }
    // Return a successful response
    return null;
  } catch (error) {
    logger.error("Error:", error);
    // Return an error response
    throw new Error("An error occurred.");
  }
});
// eslint-disable-next-line max-len
exports.randomChatsPairing = onDocumentCreated("/chats_queue/{documentId}", async (event) => {
  const senderUid = event.data.data().uid;
  const genderMatch = event.data.data().genderMatch;
  const minAgeMatch = event.data.data().minAgeMatch;
  const maxAgeMatch = event.data.data().maxAgeMatch;
  const gender = event.data.data().gender;
  const age = event.data.data().age;
  try {
    logger.info("it's work?", gender, genderMatch);
    const callsQueueRef = firestore.collection("chats_queue");
    const callsRef = firestore.collection("chats");
    let callsQueueSnapshot;
    if (genderMatch !== "both") {
      // callsQueueSnapshot = await callsQueueRef

      //     .where("gender", "==", preferGender)
      //     .where("preferGender", "not-in", [!gender])
      //     .limit(1).get();
      const genderMatchBolean = (genderMatch === "male");
      callsQueueSnapshot = await callsQueueRef
          .where("uid", "!=", senderUid)
          .where(
              Filter.or(
                  Filter.where("genderMatch", "==", "both"),
                  Filter.where("genderMatch", "==", gender ? "male" : "female"),
              ),
          )
          .where("gender", "==", genderMatchBolean)
          .get();
      logger.info("it's work?", senderUid, callsQueueSnapshot.size);
    } else {
      callsQueueSnapshot = await callsQueueRef
          .where("uid", "!=", senderUid)
          .where(
              Filter.or(
                  Filter.where("genderMatch", "==", "both"),
                  Filter.where("genderMatch", "==", gender ? "male" : "female"),
              ),
          )
          .get();
      logger.info("it's work?", senderUid, callsQueueSnapshot.size);
    }
    // eslint-disable-next-line max-len

    const matchingDocuments = callsQueueSnapshot.docs.filter((doc) => {
      const matchAge = doc.data().age;
      const matchMinAgeMatch = doc.data().minAgeMatch;
      const matchMaxAgeMatch = doc.data().maxAgeMatch;
      const isAgeMatch =
      age >= matchMinAgeMatch &&
      age <= matchMaxAgeMatch &&
      matchAge >= minAgeMatch &&
      matchAge <= maxAgeMatch;
      // eslint-disable-next-line max-len
      logger.info(doc.data(), minAgeMatch, maxAgeMatch, age,
          age >= matchMinAgeMatch, age <= matchMaxAgeMatch,
          matchAge >= minAgeMatch, matchAge <= maxAgeMatch, isAgeMatch);

      return isAgeMatch;
    });
    logger.info(matchingDocuments.length);

    if (matchingDocuments.length > 0) {
      logger.info(matchingDocuments[0].data());
      const receiverUid = matchingDocuments[0].data().uid;
      logger.info("yes sir", senderUid, receiverUid);
      await callsRef.add({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        participantIDs: [senderUid, receiverUid],
      });
      await callsQueueRef.doc(senderUid).delete();
      await callsQueueRef.doc(receiverUid).delete();
    }
    // Return a successful response
    return null;
  } catch (error) {
    logger.error("Error:", error);
    // Return an error response
    throw new Error("An error occurred.");
  }
});

exports.triggerAddComment = onDocumentCreated(
    "posts/{postId}/comments/{commentId}", async (event) => {
      const postId = event.data.data().postId;
      const postRef = firestore.collection("posts");
      try {
        const postDoc = await postRef.doc(postId).get();
        const numberOfComments = (postDoc.data().numberOfComments || 0) + 1;
        await postRef.doc(postId).update({numberOfComments});
        return numberOfComments;
      } catch (e) {
        throw new Error("Error" + e);
      }
    });

exports.triggerAddMessage = onDocumentCreated(
    "conversations/{conversationsId}/messages/{messagesId}",
    async (event) => {
      const conversationsId = event.params.conversationsId;
      const messagesId = event.params.messagesId;
      console.log(conversationsId);
      console.log(messagesId);
      try {
        // Retrieve the conversation document with conversationsId
        // eslint-disable-next-line max-len
        const conversationRef = firestore.collection("conversations").doc(conversationsId);
        const conversationSnapshot = await conversationRef.get();
        const conversationData = conversationSnapshot.data();

        if (!conversationData) {
          console.log("Conversation document not found.");
          return;
        }
        // eslint-disable-next-line max-len
        const messageRef = conversationRef.collection("messages").doc(messagesId);
        const messageSnapshot = await messageRef.get();
        const messageData = messageSnapshot.data();
        if (!messageData) {
          console.log("Message document not found.");
          return;
        }
        const userRef= firestore.collection("fimaers")
            .doc(messageData.idSender);
        const userSnapshot = await userRef.get();
        const userData = userSnapshot.data();
        logger.info(userData);
        let userFullName = userData.firstName;
        if (userData.lastName !== null) {
          userFullName += " " + userData.lastName;
        }
        console.log(userFullName);
        let noti = messageData.content;
        switch (messageData.type) {
          case "TEXT":
            noti = messageData.content;
            break;
          case "MEDIA":
            noti = "Đã gửi bạn " + messageData.content.length + " ảnh";
            break;
          case "POST_LINK":
            noti = "Đã gửi bạn 1 bài viết";
            break;
          default:
            noti = messageData.content;
        }
        const uid1 = conversationData.participantIds[0];
        const uid2 = conversationData.participantIds[1];
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            app_id: appId,
            // eslint-disable-next-line max-len
            include_external_user_ids: [(messageData.idSender === uid1) ? uid2 : uid1],
            headings: {en: userFullName},
            contents: {en: noti},
            android_group: conversationsId,
            data: {conversationId: conversationsId},
          }),
        });
        logger.info("Conversation Data:", conversationData);
        logger.info("Message Data:", messageData);
        const jsonResponse = await response.json();
        logger.info(jsonResponse);
        return new Response(
            JSON.stringify(jsonResponse),
            {
              headers: {"Content-Type": "application/json"},
            },
        );
      } catch (e) {
        throw new Error("Error: " + e);
      }
    });

exports.triggerDeleteComment = onDocumentDeleted(
    "posts/{postId}/comments/{commentId}", async (event) => {
      const postId = event.data.data().postId;
      const postRef = firestore.collection("posts");
      try {
        const postDoc = await postRef.doc(postId).get();
        const numberOfComments = (postDoc.data().numberOfComments || 1) - 1;
        await postRef.doc(postId).update({numberOfComments});
        return numberOfComments;
      } catch (e) {
        throw new Error("Error" + e);
      }
    });
exports.triggerAddPost = onDocumentCreated(
    "posts/{postId}", async (event) => {
      const postId = event.data.data().postId;
      const postMode = event.data.data().postMode;
      const publisher = event.data.data().publisher;
      const feedRef = firestore.collection("feeds");
      const followRef = firestore.collection("follows");
      const batch = firestore.batch();
      if (postMode === "PUBLIC") {
        const feedSnapshots = await feedRef.get();
        feedSnapshots.forEach((feedSnapshot) => {
          const feedId = feedSnapshot.id;
          const feedDocRef = feedRef.doc(feedId);
          batch.update(feedDocRef, {posts: firestore
              .FieldValue.arrayUnion(postId)});
        });
        await batch.commit();
      } else if (postMode === "PRIVATE") {
        try {
          const feedDoc = await feedRef.doc(publisher).get();
          if (!feedDoc.exists) {
            await feedRef.doc(publisher).set({posts: [postId]});
          } else {
            const existingPosts = feedDoc.data().posts || [];
            await feedRef.doc(publisher)
                .update({posts: [...existingPosts, postId]});
          }
        } catch (e) {
          throw new Error("Error" + e);
        }
      } else {
        try {
          const followerSnapshots = await followRef
              .where("follower", "==", publisher).get();
          followerSnapshots.forEach(async (followerSnapshot) => {
            const following = followerSnapshot.data().following;
            const feedDocRef = feedRef.doc(following);
            const feedDoc = await feedRef.doc(following).get();
            if (!feedDoc.exists) {
              batch.set(feedDocRef, {posts: [postId]});
            } else {
              batch.update(feedDocRef, {posts: firestore
                  .FieldValue.arrayUnion(postId)});
            }
          });
          await batch.commit();
        } catch (e) {
          throw new Error("Error" + e);
        }
      }
    });

exports.updateLikeuser = onDocumentUpdated("dating-profiles/{userId}", async (event) => {
  const newValue = event.data.after.data();
  const oldValue = event.data.before.data();

  const userId = event.data.before.data().uid;
  const matchsRef = firestore.collection("match");

  const oldLikeUser = oldValue.likedUsers;
  logger.info(oldLikeUser);
  const likeUser = newValue.likedUsers;
  logger.info(likeUser);
  const newUser = likeUser.filter((value) => !oldLikeUser.includes(value));
  logger.info(newUser);
  if (newUser.length > 0) {
    console.log("test");
    const datingRef = firestore.collection("dating-profiles").doc(newUser[0]);
    const datingSnapshot = await datingRef.get();
    const datingData = datingSnapshot.data();
    logger.info(userId);
    logger.info(datingData.likedUsers);
    console.log(datingData.likedUsers.includes(userId));
    if (datingData.likedUsers.includes(userId)) {
      const matchDocRef = matchsRef.doc();
      await matchDocRef.set({
        timeMatched: admin.firestore.FieldValue.serverTimestamp(),
        matchedUsers: [newUser[0], userId],
        userRead: null,
        id: matchDocRef.id,
      });
    }
  }
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
