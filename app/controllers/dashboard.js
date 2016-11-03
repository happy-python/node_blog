var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    Post = mongoose.model('Post'),
    Category = mongoose.model('Category'),
    User = mongoose.model('User'),
    slug = require('slug'),
    pinyin = require("pinyin"),
    md5 = require('md5');

var isAuthenticated = require("./auth").isAuthenticated;

module.exports = function (app) {
    app.use('/dashboard', router);
};

router.get('/', isAuthenticated, function (req, res, next) {
    // 排序
    var sortby = req.query.sortby ? req.query.sortby : 'created';
    var sortturn = req.query.sortturn ? req.query.sortturn : 'desc';
    var sort = {};
    sort[sortby] = sortturn;

    // 查询
    var conditions = {};
    if (req.query.category) {
        conditions.category = req.query.category.trim();
    }
    if (req.query.author) {
        conditions.author = req.query.author.trim();
    }
    if (req.query.keyword) {
        // i 不区分大小写的匹配
        conditions.title = new RegExp(req.query.keyword.trim(), 'i');
        conditions.content = new RegExp(req.query.keyword.trim(), 'i');
    }

    Post.find(conditions)
        .sort(sort)
        .populate('author', 'name')
        .populate('category', 'title')
        .exec(function (err, posts) {
            if (err) return next(err);
            var pageNum = parseInt(req.query.page || 1, 10);
            var pageSize = 10;
            var total = posts.length;
            var pageCount = Math.ceil(total / pageSize);
            // 使用一下 Promise
            new Promise(function (resolve, reject) {
                Category.find(function (err, categories) {
                    resolve(categories);
                });
            }).then(function (categories) {
                    return new Promise(function (resolve, reject) {
                        User.find(function (err, users) {
                            resolve({categories: categories, users: users});
                        });
                    });
                }).then(function (data) {
                    res.render('dashboard/post/index', {
                        posts: posts.slice((pageNum - 1) * pageSize, pageNum * pageSize),
                        pageNum: pageNum,
                        pageCount: pageCount,
                        sortby: sortby,
                        sortturn: sortturn,
                        categories: data.categories,
                        authors: data.users,
                        filter: {
                            category: req.query.category || "",
                            author: req.query.author || "",
                            keyword: req.query.keyword || ""
                        }
                    });
                });
        });
});

router.get('/posts/add', isAuthenticated, function (req, res, next) {
    Category.find(function (err, categories) {
        res.render('dashboard/post/add_edit', {
            pageHeader: '添加文章',
            btName: '发布文章',
            categories: categories,
            action: '/dashboard/posts/add',
            post: {}
        });
    });
});

router.post('/posts/add', isAuthenticated, function (req, res, next) {
    var obj = {
        pageHeader: '添加文章',
        btName: '发布文章',
        action: '/dashboard/posts/add'
    };
    var data = check_post_data(req, res, obj);
    if (data) {
        var title = data.title;
        var category = data.category;
        var content = data.content;

        Category.findOne({_id: mongoose.Types.ObjectId(category)})
            .exec(function (err, category) {
                if (err) return next(err);
                var py = pinyin(title, {
                    style: pinyin.STYLE_NORMAL, // 设置拼音风格
                    heteronym: true // 关闭多音字模式
                }).map(function (item) {
                    return item[0];
                }).join('-');
                var post = new Post({
                    title: title,
                    slug: slug(py),
                    category: category,
                    content: content,
                    author: req.user,
                    published: true,
                    meta: {favs: 0},
                    comments: []
                });
                post.save(function (err) {
                    if (err) return next(err);
                    req.flash('success', '文章发布成功！');
                    res.redirect('/dashboard');
                });
            });
    }
});

router.get('/posts/edit/:id', isAuthenticated, function (req, res, next) {
    var conditions = get_conditions(req.params.id);
    Post.findOne(conditions)
        .exec(function (err, post) {
            if (err) return next(err);
            Category.find(function (err, categories) {
                res.render('dashboard/post/add_edit', {
                    pageHeader: '编辑文章',
                    btName: '保存修改',
                    categories: categories,
                    action: '/dashboard/posts/edit/' + post._id,
                    post: {
                        title: post.title,
                        content: post.content
                    }
                });
            });
        });
});

router.post('/posts/edit/:id', isAuthenticated, function (req, res, next) {
    var obj = {
        pageHeader: '编辑文章',
        btName: '保存修改',
        action: '/dashboard/posts/edit/' + req.params.id
    };
    var data = check_post_data(req, res, obj);
    if (data) {
        var title = data.title;
        var category = data.category;
        var content = data.content;
        var py = pinyin(title, {
            style: pinyin.STYLE_NORMAL, // 设置拼音风格
            heteronym: true // 关闭多音字模式
        }).map(function (item) {
            return item[0];
        }).join('-');

        var conditions = get_conditions(req.params.id);
        Post.findOne(conditions)
            .exec(function (err, post) {
                if (err) return next(err);
                Category.findOne({_id: mongoose.Types.ObjectId(category)})
                    .exec(function (err, category) {
                        if (err) return next(err);
                        post.title = title;
                        post.category = category;
                        post.content = content;
                        post.slug = py;
                        post.save(function (err) {
                            if (err) return next(err);
                            req.flash('success', '文章编辑成功！');
                            res.redirect('/dashboard');
                        });
                    });
            });
    }
});

router.get('/posts/delete/:id', isAuthenticated, function (req, res, next) {
    var conditions = get_conditions(req.params.id);
    Post.findOneAndRemove(conditions, function (err) {
        if (err) return next(err);
        req.flash('success', '文章删除成功！');
        res.redirect('/dashboard');
    });
});

router.get('/categories', isAuthenticated, function (req, res, next) {
    Category.find(function (err, categories) {
        res.render('dashboard/category/index', {
            categories: categories
        });
    });
});

router.get('/categories/add', isAuthenticated, function (req, res, next) {
    res.render('dashboard/category/add_edit', {
        action: '/dashboard/categories/add',
        pageHeader: '添加分类',
        btName: "添加分类",
        category: {}
    });
});

router.post('/categories/add', isAuthenticated, function (req, res, next) {
    var obj = {
        pageHeader: '添加分类',
        btName: "添加分类",
        action: '/dashboard/categories/add'
    };
    data = check_category_data(req, res, obj);
    if (data) {
        var category = new Category({
            title: data.title,
            slug: data.slug_name || data.py
        });
        category.save(function (err) {
            if (err) return next(err);
            req.flash('success', '分类保存成功！');
            res.redirect('/dashboard/categories');
        });
    }
});

router.get('/categories/edit/:id', isAuthenticated, function (req, res, next) {
    var conditions = get_conditions(req.params.id);
    Category.findOne(conditions)
        .exec(function (err, category) {
            if (err) return next(err);
            res.render('dashboard/category/add_edit', {
                action: '/dashboard/categories/edit/' + category._id,
                pageHeader: '编辑分类',
                btName: "保存修改",
                category: category
            });
        });
});

router.post('/categories/edit/:id', isAuthenticated, function (req, res, next) {
    var obj = {
        pageHeader: '添加分类',
        btName: "添加分类",
        action: '/dashboard/categories/edit/' + req.params.id
    };
    data = check_category_data(req, res, obj);
    if (data) {
        var conditions = get_conditions(req.params.id);
        Category.findOne(conditions)
            .exec(function (err, category) {
                if (err) return next(err);
                category.title = data.title;
                category.slug = data.slug_name || data.py;
                category.save(function (err) {
                    if (err) return next(err);
                    req.flash('success', '分类编辑成功！');
                    res.redirect('/dashboard/categories');
                });
            });
    }
});

router.get('/categories/delete/:id', isAuthenticated, function (req, res, next) {
    var conditions = get_conditions(req.params.id);
    Category.findOneAndRemove(conditions, function (err) {
        if (err) return next(err);
        req.flash('success', '分类删除成功！');
        res.redirect('/dashboard/categories');
    });
});

function get_conditions(id) {
    var conditions = {};
    try {
        conditions._id = mongoose.Types.ObjectId(id);
    } catch (err) {
        conditions.slug = id;
    }
    return conditions;
}

function check_category_data(req, res, obj) {
    req.checkBody('title', '分类名称不能为空').notEmpty();

    var errors = req.validationErrors();
    if (errors) {
        return res.render('dashboard/category/add_edit', {
            errors: errors,
            pageHeader: obj.pageHeader,
            btName: obj.btName,
            action: obj.action,
            category: {
                title: req.body.title,
                slug: req.body.slug_name
            }
        });
    }

    var title = req.body.title.trim();
    var slug_name = req.body.slug_name.trim();
    var py = pinyin(title, {
        style: pinyin.STYLE_NORMAL, // 设置拼音风格
        heteronym: true // 关闭多音字模式
    }).map(function (item) {
        return item[0];
    }).join('-');
    return {title: title, slug_name: slug_name, py: py};
}

function check_post_data(req, res, obj) {
    req.checkBody('title', '文章标题不能为空').notEmpty();
    req.checkBody('category', '必须指定文章分类').notEmpty();
    req.checkBody('content', '文章内容不能为空').notEmpty();

    var errors = req.validationErrors();
    if (errors) {
        Category.find(function (err, categories) {
            res.render('dashboard/post/add_edit', {
                errors: errors,
                pageHeader: obj.pageHeader,
                btName: obj.btName,
                categories: categories,
                action: obj.action,
                post: {
                    title: req.body.title,
                    content: req.body.content
                }
            });
        });
        return;
    }
    var title = req.body.title.trim();
    var category = req.body.category;
    var content = req.body.content.trim();
    var py = pinyin(title, {
        style: pinyin.STYLE_NORMAL, // 设置拼音风格
        heteronym: true // 关闭多音字模式
    }).map(function (item) {
        return item[0];
    }).join('-');
    return {title: title, category: category, content: content, py: py};
}

router.get('/password', isAuthenticated, function (req, res, next) {
    res.render('dashboard/password');
});

router.post('/password', isAuthenticated, function (req, res, next) {
    req.checkBody('password', '密码不能为空').notEmpty();
    req.checkBody('confirm', '两次密码不匹配').notEmpty().equals(req.body.password);

    var errors = req.validationErrors();
    if (errors) {
        return res.render('dashboard/password', {
            errors: errors
        });
    }

    var user = req.user;
    user.password = md5(req.body.password.trim());
    user.save(function (err) {
        if (err) return next(err);
        req.flash('success', '密码修改成功！');
        res.redirect('/dashboard');
    });
});
