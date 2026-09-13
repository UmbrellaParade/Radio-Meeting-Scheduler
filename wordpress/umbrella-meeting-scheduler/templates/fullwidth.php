<?php
if (!defined('ABSPATH')) {
    exit;
}
get_header();
?>
<main id="ums-content" class="ums-page">
    <?php
    while (have_posts()) {
        the_post();
        the_content();
    }
    ?>
</main>
<?php get_footer(); ?>
