var async = require('async'),
    https = require('https');

var facebook = {
  getPosts: function (fbUsers, callback) {
    var fbResponses = {};
    var userIds = Object.keys(fbUsers);
    async.each(userIds,
      function (userId, asyncCallback) {
        var user = fbUsers[ userId ];
        user.url = '/v2.2/' + user.userId + '/feed?access_token=' + user.accessToken;
        if (user.last) {
          user.url += '&min_id=' + user.last;
        }
        // console.log(user.url);
        var options = {
          host: 'graph.facebook.com',
          path: user.url,
          method: 'GET'
        }
        var temp = '';
        console.log('https://' + options.host + options.path);
        var req = https.request(options, function (res) {
          // console.log('STATUS: ' + res.statusCode);
          // console.log('HEADERS: ' + JSON.stringify(res.headers));
          var pageData = '';
          res.setEncoding('utf-8');
          res.on('data', function (chunk) {
            // console.log('DATA: ' + chunk);
            pageData += chunk;
          });
          res.on('end', function () {
            fbResponses[ userId ] = JSON.parse(pageData);
            asyncCallback();
          });
        });
        req.on('error', function (e) {
          console.log(e);
          asyncCallback(e);
        });
        req.end();
    },
      function (err) {
        // async callback
        if (err) {
          console.log(err);
          return callback(err);
        } else {
          // return callback (null, fbResponses);
          facebook.normalizePosts (fbResponses, function (err, normalizedPosts) {
            return callback (null, normalizedPosts);
          })
        }
    });
  },
  normalizePosts: function (facebookResponse, callback) {
    var normalizedPosts = {};
    Object.keys(facebookResponse).forEach( function (key, index) {
      var data = facebookResponse[ key ].data;
      normalizedPosts[ key ] = {
        facebook: {
          posts: [],
          last: 0
        }
      };
      var last = 0;
      var length = data.length;
      for (var i = 0; i < length; i++) {
          var tmp = {};
          var tmpPost = data[ i ]; // reference to the post, for ease of typing
          tmp.postId = tmpPost.object_id;
          tmp.userId = key;
          tmp.source = {
            network: 'facebook',
            data: tmpPost
          };
          tmp.content = {
            text: tmpPost.message
          };
          if (tmpPost.picture) {
            tmp.content.img = [ tmpPost.picture ];
          }
          tmp.permalink = tmpPost.actions[ 0 ].link; // get the permalink from the actions field
          tmp.timestamp = new Date(Date.parse(tmpPost.created_time)).toISOString();
          normalizedPosts[ key ].facebook.posts[ i ] = tmp;
          if (parseInt(tmp.postId) > parseInt(last)) {
            last = tmp.postId;
          }
          normalizedPosts[ key ].facebook.last = last;
        }
    }, facebookResponse);
    return callback (null, normalizedPosts);
  },
  buildApiRequests: function (userObject, callback) {
    //
  }
}

module.exports = facebook;