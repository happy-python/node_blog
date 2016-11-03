var express = require('express');
var glob = require('glob');
var moment = require('moment');
var truncate = require('truncate');
var session = require('express-session');
var flash = require('connect-flash');
var messages = require('express-messages');
var mongoose = require('mongoose');
var expressValidator = require('express-validator');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var MongoStore = require('connect-mongo')(session);

var Category = mongoose.model('Category');
var User = mongoose.model('User');

var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compress = require('compression');
var methodOverride = require('method-override');

module.exports = function (app, config, connection) {
    var env = process.env.NODE_ENV || 'development';
    app.locals.ENV = env;
    app.locals.ENV_DEVELOPMENT = env == 'development';
    app.locals.moment = moment;
    app.locals.truncate = truncate;

    app.set('views', config.root + '/app/views');
    app.set('view engine', 'jade');
    app.use(favicon(config.root + '/public/img/favicon.ico'));
    app.use(logger('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    // 校验
    app.use(expressValidator({
        errorFormatter: function(param, msg, value) {
            var namespace = param.split('.'),
                root    = namespace.shift(),
                formParam = root;

            while(namespace.length) {
                formParam += '[' + namespace.shift() + ']';
            }
            return {
                param : formParam,
                msg   : msg,
                value : value
            };
        }
    }));
    app.use(cookieParser());
    app.use(session({
        secret: 'node_blog',
        name: 'blog',   // 这里的name是cookie的name，默认cookie的name是：connect.sid
        resave: false,
        saveUninitialized: true,
        cookie: {secure: false, maxAge: 1800000},
        store: new MongoStore({mongooseConnection: connection})
    }));
    // 认证
    app.use(passport.initialize());
    app.use(passport.session());
    passport.use(new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password'
        }, function(email, password, done) {
            User.findOne({ email: email }, function(err, user) {
                if (err) { return done(err); }
                if (!user) {
                    return done(null, false, {message: '此用户不存在'});
                }
                if (!user.validPassword(password)) {
                    return done(null, false, {message: '密码不匹配'});
                }
                return done(null, user);
            });
        }
    ));
    // 中间件
    passport.serializeUser(function(user, done) {
        done(null, user._id);
    });
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });
    // 自定义中间件
    app.use(function (req, res, next) {
        app.locals.path = req.path;
        app.locals.user = req.user;
        next();
    });
    // 消息提示
    app.use(flash());
    app.use(function (req, res, next) {
        res.locals.messages = messages(req, res);
        next();
    });
    app.use(compress());
    app.use(express.static(config.root + '/public'));
    app.use(methodOverride());

    var controllers = glob.sync(config.root + '/app/controllers/*.js');
    controllers.forEach(function (controller) {
        require(controller)(app);
    });

    app.use(function (req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    if (app.get('env') === 'development') {
        app.use(function (err, req, res, next) {
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: err,
                title: 'error'
            });
        });
    }

    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {},
            title: 'error'
        });
    });
};
