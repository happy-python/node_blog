var config = require('./config/config'),
    glob = require('glob'),
    mongoose = require('mongoose'),
    loremIpsum = require('lorem-ipsum'),
    slug = require('slug');

mongoose.connect(config.db);
var db = mongoose.connection;
db.on('error', function () {
    throw new Error('unable to connect to database at ' + config.db);
});

var models = glob.sync(config.root + '/app/models/*.js');
models.forEach(function (model) {
    require(model);
});

var User = mongoose.model('User'),
    Post = mongoose.model('Post'),
    Category = mongoose.model('Category');

User.findOne(function (err, user) {
    if (err) throw new Error('cannot find user');
    Category.find(function (err, categories) {
        if (err) throw new Error('cannot find categories');
        categories.forEach(function (category) {
            for (var i = 0; i < 10; i++) {
                title = loremIpsum({count: 3, units: 'words'});
                var post = new Post({
                    title: title,
                    content: loremIpsum({count: 5, units: 'paragraphs'}),
                    slug: slug(title),
                    category: category,
                    author: user,
                    published: true,
                    meta: {favs: 0},
                    comments: []
                });
                post.save(function (err, post) {
                    console.log('saved post: ', post.slug);
                });
            }
        });
    });
});
