var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    Post = mongoose.model('Post'),
    Category = mongoose.model('Category');

module.exports = function (app) {
    app.use('/', router);
};

router.get('/', function (req, res, next) {
    // 搜索
    var conditions = {published: true};
    if (req.query.keyword) {
        // i 不区分大小写的匹配
        conditions.title = new RegExp(req.query.keyword.trim(), 'i');
        conditions.content = new RegExp(req.query.keyword.trim(), 'i');
    }
    Post.find(conditions)
        .sort('-created')
        .populate('author')
        .populate('category')
        .exec(function (err, posts) {
            if (err) return next(err);
            var pageNum = parseInt(req.query.page || 1, 10);
            var pageSize = 10;
            var total = posts.length;
            var pageCount = Math.ceil(total / pageSize);
            Category.find(function (err, categories) {
                if (err) return next(err);
                res.render('home/index', {
                    categories: categories,
                    posts: posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
                    pageNum: pageNum,
                    pageCount: pageCount,
                    keyword: req.query.keyword
                });
            });
        });
});

router.get('/posts/category/:title', function (req, res, next) {
    Category.findOne({title: req.params.title}).exec(function (err, category) {
        if (err) return next(err);
        Post.find({category: category, published: true})
            .sort('created')
            .populate('author')
            .populate('category')
            .exec(function (err, posts) {
                if (err) return next(err);
                var pageNum = parseInt(req.query.page || 1, 10);
                var pageSize = 5;
                var total = posts.length;
                var pageCount = Math.ceil(total / pageSize);
                Category.find(function (err, categories) {
                    if (err) return next(err);
                    res.render('home/category', {
                        categories: categories,
                        posts: posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
                        category: category,
                        pageNum: pageNum,
                        pageCount: pageCount,
                        total: total
                    });
                });
            });
    });
});

router.get('/posts/detail/:id', function (req, res, next) {
    var conditions = {};
    try {
        conditions._id = mongoose.Types.ObjectId(req.params.id);
    } catch (err) {
        conditions.slug = req.params.id;
    }
    Post.findOne(conditions)
        .populate('author')
        .populate('category')
        .exec(function (err, post) {
            if (err) return next(err);
            Category.find(function (err, categories) {
                if (err) return next(err);
                res.render('home/detail', {
                    categories: categories,
                    post: post
                });
            });
        });
});

router.get('/posts/favs/:id', function (req, res, next) {
    var conditions = {};
    try {
        conditions._id = mongoose.Types.ObjectId(req.params.id);
    } catch (err) {
        conditions.slug = req.params.id;
    }
    Post.findOne(conditions).exec(function (err, post) {
        if (err) return next(err);
        post.meta.favs = post.meta.favs ? post.meta.favs + 1 : 1;
        post.markModified('meta');
        post.save(function (err) {
            res.redirect('/posts/detail/' + post.slug);
        });
    });
});

router.post('/posts/comment/:id', function (req, res, next) {
    var conditions = {};
    try {
        conditions._id = mongoose.Types.ObjectId(req.params.id);
    } catch (err) {
        conditions.slug = req.params.id;
    }
    Post.findOne(conditions).exec(function (err, post) {
        if (err) return next(err);
        var comment = {
            email: req.body.email,
            content: req.body.content,
            created: new Date()
        };
        post.comments.unshift(comment);
        post.markModified('comments');
        post.save(function (err) {
            req.flash('success', '评论成功！');
            res.redirect('/posts/detail/' + post.slug);
        });
    });
});

router.get('/about', function (req, res, next) {
    Category.find(function (err, categories) {
        if (err) return next(err);
        res.render('home/about', {
            categories: categories
        });
    });
});

router.get('/contact', function (req, res, next) {
    Category.find(function (err, categories) {
        if (err) return next(err);
        res.render('home/contact', {
            categories: categories
        });
    });
});
