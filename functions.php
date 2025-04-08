
<?php
function get_videos_by_description($request) {
    $description = $request->get_param('description'); // Get description filter from request

    $args = array(
        'post_type'      => 'attachment',
        'post_mime_type' => 'video',
        'posts_per_page' => -1,
        'meta_query'     => array(
            array(
                'key'     => '_wp_attachment_metadata',
                'compare' => 'EXISTS',
            ),
        ),
    );

    $videos = get_posts($args);
    $data = array();

    foreach ($videos as $video) {
        $video_description = get_post_field('post_content', $video->ID); // Get description
        $video_caption     = get_post_field('post_excerpt', $video->ID); // Get caption
        $likes             = (int) get_post_meta($video->ID, 'video_likes', true); // Get likes (default to 0)

        if (stripos($video_description, $description) !== false) {
            $data[] = array(
                'id'          => $video->ID,
                'title'       => get_the_title($video->ID),
                'url'         => wp_get_attachment_url($video->ID),
                'date'        => get_the_date('Y-m-d H:i:s', $video->ID),
                'description' => $video_description,
                'caption'     => $video_caption,
                'likes'       => $likes,
            );
        }
    }

    return rest_ensure_response($data);
}



function register_video_description_api() {
    register_rest_route('custom-api/v1', '/videos/', array(
        'methods'  => 'GET',
        'callback' => 'get_videos_by_description',
        'args'     => array(
            'description' => array(
                'required'          => true,
                'validate_callback' => function ($param) {
                    return !empty($param);
                },
            ),
        ),
    ));
}

add_action('rest_api_init', 'register_video_description_api');

function add_shortcode_to_posts($content) {
    if (is_single() && in_the_loop() && is_main_query()) {
        $shortcode = do_shortcode('[sc name="reelvideos"][/sc]'); // Replace with your actual shortcode
        //$content = $shortcode . $content; // Add before content
        $content .= $shortcode; // Uncomment this to add after content instead
    }
    return $content;
}
add_filter('the_content', 'add_shortcode_to_posts');


function update_video_likes(WP_REST_Request $request) {
    $video_id = $request->get_param('video_id');
    $change   = $request->get_param('change'); // should be +1 or -1

    if (!in_array($change, [1, -1])) {
        return new WP_Error('invalid_change', 'Change must be 1 or -1', array('status' => 400));
    }

    // Make sure the video exists
    if (get_post_type($video_id) !== 'attachment') {
        return new WP_Error('invalid_id', 'Invalid video ID', array('status' => 404));
    }

    // Get current likes
    $likes = (int) get_post_meta($video_id, 'video_likes', true);
    $likes += $change;
    if ($likes < 0) $likes = 0;

    update_post_meta($video_id, 'video_likes', $likes);

    return rest_ensure_response([
        'video_id' => $video_id,
        'likes'    => $likes
    ]);
}

function register_video_likes_api() {
    register_rest_route('custom-api/v1', '/video-likes/', array(
        'methods'  => 'POST',
        'callback' => 'update_video_likes',
        'args'     => array(
            'video_id' => array(
                'required' => true,
                'validate_callback' => function($param) {
                    return is_numeric($param);
                },
            ),
            'change' => array(
                'required' => true,
                'validate_callback' => function($param) {
                    return in_array($param, [1, -1]);
                },
            ),
        ),
    ));
}
add_action('rest_api_init', 'register_video_likes_api');
