<?php
/**
 * Plugin Name: Umbrella Meeting Scheduler
 * Plugin URI: https://github.com/UmbrellaParade/Radio-Meeting-Scheduler
 * Description: バンドのスタジオリハとラジオの打ち合わせを調整するツールです。共有ページ、出欠回答、連絡文面に対応します。
 * Version: 1.0.1
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Umbrella Parade
 * Author URI: https://bellbo13.com/
 * Update URI: https://github.com/UmbrellaParade/Radio-Meeting-Scheduler
 * Text Domain: umbrella-meeting-scheduler
 */

if (!defined('ABSPATH')) {
    exit;
}

define('UMS_VERSION', '1.0.1');
define('UMS_PAGE_TEMPLATE', 'umbrella-meeting-scheduler-fullwidth');

function ums_enqueue_assets() {
    wp_enqueue_style('umbrella-meeting-scheduler', plugins_url('assets/embed.css', __FILE__), array(), UMS_VERSION);
    wp_enqueue_script('umbrella-meeting-scheduler', plugins_url('assets/embed.js', __FILE__), array(), UMS_VERSION, true);
}

function ums_enqueue_page_assets() {
    if (is_singular() && has_shortcode(get_post_field('post_content', get_queried_object_id()), 'umbrella_meeting_scheduler')) {
        ums_enqueue_assets();
    }
}
add_action('wp_enqueue_scripts', 'ums_enqueue_page_assets');

function ums_shortcode($attributes = array()) {
    $attributes = shortcode_atts(array('mode' => 'band'), $attributes, 'umbrella_meeting_scheduler');
    $mode = $attributes['mode'] === 'radio' ? 'radio' : 'band';
    $page_url = get_permalink(get_queried_object_id());
    if (!$page_url) {
        $page_url = home_url('/');
    }

    ums_enqueue_assets();

    return sprintf(
        '<div class="ums-embed"><iframe class="ums-frame" title="バンド・ラジオの日程調整" data-ums-src="%1$s" data-ums-page-url="%2$s" data-ums-default-mode="%3$s" allow="clipboard-write"></iframe><noscript><p>日程調整ツールを利用するにはJavaScriptを有効にしてください。</p></noscript></div>',
        esc_url(plugins_url('app/index.html', __FILE__)),
        esc_url($page_url),
        esc_attr($mode)
    );
}
add_shortcode('umbrella_meeting_scheduler', 'ums_shortcode');

function ums_page_templates($templates) {
    $templates[UMS_PAGE_TEMPLATE] = '日程調整ツール（全幅）';
    return $templates;
}
add_filter('theme_page_templates', 'ums_page_templates');

function ums_page_template($template) {
    if (is_page() && get_page_template_slug(get_queried_object_id()) === UMS_PAGE_TEMPLATE) {
        return __DIR__ . '/templates/fullwidth.php';
    }
    return $template;
}
add_filter('template_include', 'ums_page_template', 99);

function ums_admin_menu() {
    add_menu_page('日程調整', '日程調整', 'manage_options', 'umbrella-meeting-scheduler', 'ums_admin_page', 'dashicons-calendar-alt', 59);
}
add_action('admin_menu', 'ums_admin_menu');

function ums_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $page_id = absint(get_option('ums_page_id'));
    $page = $page_id ? get_post($page_id) : null;
    ?>
    <div class="wrap">
        <h1>日程調整</h1>
        <p>バンドのスタジオリハとラジオの打ち合わせに使える日程調整ツールです。</p>
        <?php if ($page && $page->post_status !== 'trash') : ?>
            <p><a class="button button-primary" href="<?php echo esc_url(get_permalink($page)); ?>" target="_blank" rel="noopener">日程調整ページを開く</a>
            <a class="button" href="<?php echo esc_url(get_edit_post_link($page->ID)); ?>">固定ページを編集</a></p>
            <p>公開URL: <a href="<?php echo esc_url(get_permalink($page)); ?>"><?php echo esc_html(get_permalink($page)); ?></a></p>
        <?php else : ?>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="ums_create_page">
                <?php wp_nonce_field('ums_create_page'); ?>
                <?php submit_button('日程調整の公開ページを作成'); ?>
            </form>
        <?php endif; ?>
        <h2>別のページに設置する場合</h2>
        <p>固定ページのショートコードブロックに <code>[umbrella_meeting_scheduler]</code> を設定します。</p>
        <p>最初にラジオを表示する場合: <code>[umbrella_meeting_scheduler mode="radio"]</code>。一度選んだタブは次回も維持されます。</p>
        <h2>保存と共有</h2>
        <p>作業中の設定は、このサイトを開いているブラウザに保存されます。共有ページを作成・更新したときに、候補日時と案内文を既存のGoogle Apps Scriptへ送信します。参加者の出欠も同じバックエンドへ保存します。</p>
        <p>以前のGitHub版から移行する場合は、各タブの「JSON保存」で書き出し、このサイトの「JSON読込」で取り込めます。ブラウザ内の作業データは、プラグインの無効化や更新では削除されません。</p>
    </div>
    <?php
}

function ums_create_page() {
    if (!current_user_can('manage_options')) {
        wp_die('この操作を行う権限がありません。', '', array('response' => 403));
    }
    check_admin_referer('ums_create_page');
    $page_id = absint(get_option('ums_page_id'));
    if (!$page_id || !get_post($page_id) || get_post_status($page_id) === 'trash') {
        $page_id = wp_insert_post(array(
            'post_type' => 'page',
            'post_title' => '日程調整',
            'post_name' => 'meeting-scheduler',
            'post_status' => 'publish',
            'post_content' => '<!-- wp:shortcode -->[umbrella_meeting_scheduler]<!-- /wp:shortcode -->',
            'comment_status' => 'closed',
            'ping_status' => 'closed',
            'meta_input' => array('_wp_page_template' => UMS_PAGE_TEMPLATE),
        ), true);
        if (is_wp_error($page_id)) {
            wp_die(esc_html($page_id->get_error_message()));
        }
        update_option('ums_page_id', $page_id, false);
    }
    wp_safe_redirect(admin_url('admin.php?page=umbrella-meeting-scheduler'));
    exit;
}
add_action('admin_post_ums_create_page', 'ums_create_page');
