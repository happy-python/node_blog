var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    md5 = require('md5'),
    User = mongoose.model('User'),
    passport = require('passport');

module.exports = function (app) {
    app.use('/auth', router);
};

// 将req.isAuthenticated()封装成中间件
module.exports.isAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/auth/login');
};

router.get('/login', function (req, res, next) {
    res.render('auth/login');
});

router.post('/login', passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/auth/login',
        failureFlash: true
    })
);

router.get('/regist', function (req, res, next) {
    res.render('auth/regist');
});

router.post('/regist', function (req, res, next) {
    req.checkBody('email', '邮箱不能为空').notEmpty();
    req.checkBody('password', '密码不能为空').notEmpty();
    req.checkBody('confirm', '两次密码不匹配').notEmpty().equals(req.body.password);

    var errors = req.validationErrors();
    if (errors) {
        return res.render('auth/regist', {
            errors: errors
        });
    }
    var user = new User({
        // shift() 方法用于把数组的第一个元素从其中删除，并返回第一个元素的值
        name: req.body.email.split('@').shift(),
        email: req.body.email,
        password: md5(req.body.password)
    });
    user.save(function (err) {
        if (err) {
            req.flash('error', '注册失败！');
            res.redirect('/auth/regist');
        } else {
            req.flash('success', '注册成功！');
            res.redirect('/auth/login');
        }
    });
});

router.get('/logout', function (req, res, next) {
    req.logout();
    res.redirect('/');
});
