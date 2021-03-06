var crypto = require('crypto'),
    http = require('http'),
    OAuth = require('oauth'),
    async = require('async')
    ;

var methods = function (secrets) {
  return {
    normalizePosts: function (twitterResponses, callback) {
      var normalizedPosts = {};
      for (var ssUserId in twitterResponses) {
        if (twitterResponses.hasOwnProperty(ssUserId)) {
          normalizedPosts[ ssUserId ] = {
            twitter: {
              posts: [],
              last: 0
            }
          }
          if (twitterResponses[ ssUserId ].error) {
            normalizedPosts[ ssUserId ].oauthIssue = twitterResponses[ ssUserId ].error;
          } else {
            var last = 0;
            var length = twitterResponses[ ssUserId ].length;
            for (var i = 0; i < length; i++) {
              var tmp = {};
              var tmpPost = twitterResponses[ ssUserId ][ i ];
              tmp.postId = tmpPost.id_str;
              tmp.userId = ssUserId;
              tmp.source = {
                network: 'twitter',
                data: tmpPost
              };
              tmp.content = {
                text: tmpPost.text
              };
              if (tmpPost.entities.media) {
                tmp.content.img = [];
                for (var j = 0; j < tmpPost.entities.media.length; j++) {
                  tmp.content.img.push(tmpPost.entities.media[ j ].media_url);
                }
              }
              tmp.timestamp = new Date(Date.parse(tmpPost.created_at)).toISOString();
              tmp.permalink = 'https://twitter.com/' + tmpPost.user.screen_name + '/status/' + tmpPost.id_str;
              normalizedPosts[ ssUserId ].twitter.posts[ i ] = tmp;
              if (parseInt(tmp.postId) > parseInt(last)) {
                last = tmp.postId;
              }
              normalizedPosts[ ssUserId ].twitter.last = last;
            }
          }
        }
      }
      return callback (null, normalizedPosts);
    },
    doOauthQuery: function (user, callback) {
      // get posts via the oauth npm package
      var oauth = new OAuth.OAuth(
        'https://api.twitter.com/oauth/request_token',
        'https://api.twitter.com/oauth/access_token',
        secrets.twitter.consumerKey, // consumer key
        secrets.twitter.consumerSecret, // consumer secret
        '1.0A',
        null,
        'HMAC-SHA1'
        );
      // console.log(user);
      // console.log(user.userToken, user.userTokenSecret);
      oauth.get(
        user.url, // url
        user.accessToken, // user token
        user.tokenSecret, // user secret
        // undefined,
        // undefined,
        function (e, data, res) {
          if (e) {
            if (e.data) {
              // an oauth error appears to return data about the error
              return callback (e.data);
            } else {
              // connection errors do not contain a `data`
              var error = {
                connectionError: e
              };
              return callback (error);
            }
          }
          if (data && res.statusCode === 200) {
            return callback (null, JSON.parse(data));
          }
        });
    },
    getPosts: function (twitterUsers, callback) {
      var twitterFunctions = this;
      var twResponses = {},
          users = Object.keys(twitterUsers); // makes an array of the user IDs for async to iterate over
      async.each(users, function (userId, asyncCallback) {
        var user = twitterUsers[ userId ];
        // build the url
        user.url = 'https://api.twitter.com/1.1/statuses/user_timeline.json?';
        if (user.userId) {
          user.url += 'user_id=' + user.userId;
        } else if (user.screenName) {
          user.url += 'screen_name=' + user.screenName;
        }
        if (user.last) {
          user.url += '&since_id=' + user.last;
        }
        // pass the user object (with id, token, secret, and url) to oauth
        twitterFunctions.doOauthQuery (user, function (err, pageData) {
          if (err) {
            if (err.connectionError) {
              // connection errors stop post retreival/processing and are returned to parent as errors
              return asyncCallback (err.connectionError);
              } else {
              // this error comes from oauth request
              twResponses[ userId ] = {
                error: err
              }
            }
          } else {
            // console.log(userId, ': found posts');
            twResponses[ userId ] = pageData;
          }
          asyncCallback ();
        });
      }, function (err) {
        // asyncCallback()
        if (err) {
          var twitterError = { // wrap the error in an object identifying the network
            twitter: err
          }
          return callback (twitterError);
        } else {
          twitterFunctions.normalizePosts(twResponses, function (err, normalizedPosts) {
            return callback (null, normalizedPosts);
          })
        }
      });
    }
  }
}

module.exports = methods;
