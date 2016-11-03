$(document).ready(function () {
    // 筛选
    $('#filter-submit').on('click', function () {
        var query = querystring.parse(window.location.search);
        var category = $('#category').val();
        var author = $('#author').val();
        var keyword = $('#keyword').val();

        if (category) {
            query.category = category;
        } else {
            delete query.category;
        }

        if (author) {
            query.author = author;
        } else {
            delete query.author;
        }

        if (keyword) {
            query.keyword = keyword;
        } else {
            delete query.keyword;
        }

        if (query) {
            window.location.href = window.location.origin + window.location.pathname + '?' + querystring.stringify(query);
        } else {
            window.location.href = window.location.origin + window.location.pathname + querystring.stringify(query);
        }
    });

    // CKEDITOR
    try {
        CKEDITOR.replace('content');
    } catch (err) {
    }
});
