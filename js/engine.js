// engine.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2020-05-28
//
// used as a base for all frameworks
// unlike common.js, states are required
// contains global vars but the script will be imported in a function => they become local
//
// included after: common
/*
globals
_, A, Abs, Assign, Attrs, Clamp, clearInterval, clearTimeout, CreateNode, DefaultFloat, document, E, From, history,
HTML, Id, Keys, LoadLibrary, localStorage, location, LS, Min, NAMESPACE_SVG, navigator, Now, Parent, QueryString,
requestAnimationFrame, Resource, ScrollDocument, SetDefault, setInterval, setTimeout, Style, TEXT, Title, Undefined,
Visible, window
*/
'use strict';

let __PREFIX = '_',
    ANCHORS = {},
    api = {},
    api_times = {},
    DEFAULTS = {
        language: '',
        theme: '',
    },
    DEV = {},
    device = {},
    drag,
    drag_moved,
    drag_scroll = 3,
    drag_target,
    drag_type,
    full_scroll = {x: 0, y: 0},
    full_target,
    ICONS = {},
    KEY_TIMES = {},
    KEYS = {},
    LANGUAGES = {},
    // only if they're different from the first 2 letters, ex: it:ita is not necessary
    LANGUAGES_23 = {
        es: 'spa',
        ja: 'jpn',
        pl: 'pol',
        sv: 'swe',
    },
    libraries = {},
    Lower = (text) => (text.toLowerCase()),
    QUERY_KEYS = {
        '': '?',
        hash: '#',
    },
    scroll_target,
    STATE_KEYS = {},
    THEMES = [''],
    TIMEOUT_adjust = 250,
    TIMEOUT_touch = 0.5,
    TIMEOUT_translate = 3600 * 24,
    timers = {},
    touch_done = 0,                                     // time when the touch was released
    TOUCH_ENDS = {mouseleave: 1, mouseup: 1, touchend: 1},
    touch_last = {x: 0, y: 0},
    TOUCH_MOVES = {mousemove: 1, touchmove: 2},
    touch_moves = [],
    touch_now,
    touch_scroll = {x: 0, y: 0},
    touch_speed = {x: 0, y: 0},
    touch_start,
    TOUCH_STARTS = {mousedown: 1, mouseenter: 1, touchstart: 2},
    TRANSLATE_SPECIALS = {},
    translates = {},
    TRANSLATES = {},
    Upper = (text) => (text.toUpperCase()),
    // virtual functions, can be assigned
    virtual_check_hash_special,
    virtual_rename_option,
    virtual_sanitise_data_special,
    virtual_set_combo_special,
    X_SETTINGS = {},
    Y = {};                                             // params

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// HELPERS
//////////

/**
 * Add a timeout / interval
 * @param {string} name
 * @param {function} func function to be called after the timer
 * @param {number} timer milliseconds <0: does nothing, =0: executes directly, >0: timer
 * @param {boolean=} is_interval
 */
function add_timeout(name, func, timer, is_interval) {
    clear_timeout(name);
    if (timer < 0)
        return;

    if (timer)
        timers[name] = [
            is_interval? setInterval(func, timer): setTimeout(func, timer),
            is_interval? 1: 0,
        ];
    else
        func();
    if (DEV.frame) {
        LS(`add_timeout: ${name} : ${timer} : ${is_interval}`);
        LS(timers);
    }
}

/**
 * Clear a timeout / interval
 * @param {string} name
 */
function clear_timeout(name) {
    let timer = timers[name];
    if (!timer)
        return;

    if (timer[1])
        clearInterval(timer[0]);
    else
        clearTimeout(timer[0]);

    delete timers[name];
    if (DEV.frame)
        LS(`clear_timeout: ${name} : ${timer}`);
}

/**
 * Local Storage - get float
 * @param {string} name
 * @param {number} def
 * @returns {number}
 */
function get_float(name, def) {
    return DefaultFloat(get_string(name), def);
}

/**
 * Local Storage - get int/bool
 * @param {string} name
 * @param {number|boolean} def also used if the value cannot be converted to an `int`
 * @returns {number|boolean}
 */
function get_int(name, def) {
    let value = parseInt(get_string(name));
    if (isNaN(value))
        value = def;
    if (typeof(def) == 'boolean')
        value = !!value;
    return value;
}

/**
 * Local Storage - get an object
 * @param {string} name
 * @param {*=} def
 * @returns {Object}
 */
function get_object(name, def) {
    let result,
        text = get_string(name);
    if (!text)
        return def;
    try {
        result = JSON.parse(text);
    }
    catch(error) {
        result = def;
    }
    return result;
}

/**
 * Local Storage - get string
 * @param {string} name
 * @param {string} def
 * @returns {string}
 */
function get_string(name, def) {
    let value = localStorage.getItem(`${__PREFIX}${name}`);
    return (value == 'undefined')? def: (value || def);
}

/**
 * Load a library only once
 * @param {string} url
 * @param {function=} callback
 * @param {Object=} extra
 */
function load_library(url, callback, extra) {
    if (!libraries[url])
        LoadLibrary(url, () => {
            if (DEV.load)
                LS(`loaded: ${url}`);
            libraries[url] = Now();
            if (callback)
                callback();
        }, extra);
    else
        LS(`already loaded: ${url}`);
}

/**
 * Merge settings
 * @param {Object} x_settings
 */
function merge_settings(x_settings) {
    Keys(x_settings).forEach(name => {
        let value = x_settings[name];

        // audio: { ... }
        if (typeof(value) == 'object') {
            let exists = SetDefault(X_SETTINGS, name, {});
            Assign(exists, value);
            X_SETTINGS[name] = Assign({}, ...Keys(exists).sort().map(key => ({[key]: exists[key]})));
        }
        // _split: 8
        else
            X_SETTINGS[name] = value;
    });

    // update defaults
    Keys(X_SETTINGS).forEach(name => {
        let settings = X_SETTINGS[name];
        if (typeof(settings) == 'object')
            Assign(DEFAULTS, Assign({}, ...Keys(settings).map(key => ({[key]: settings[key][1]}))));
    });
}

/**
 * Local Storage - remove a key
 * @param {string} name
 */
function remove_storage(name) {
    localStorage.removeItem(`${__PREFIX}${name}`);
}

/**
 * Save a Y value + to Local Storage
 * @param {string} name
 * @param {*} value value for the name, undefined to save Y[name]
 */
function save_option(name, value) {
    if (value === undefined)
        value = Y[name];
    else
        Y[name] = value;
    save_storage(name, value);
}

/**
 * Local Storage - save a value
 * - true is converted to 1
 * - false and undefined are converted to 0
 * @param {string} name
 * @param {*} value value for the name
 */
function save_storage(name, value) {
    if (typeof(value) == 'object')
        value = JSON.stringify(value);
    else if (value === true)
        value = 1;
    else if (value === false || value === undefined)
        value = 0;

    localStorage.setItem(`${__PREFIX}${name}`, value);
}

// TRANSLATIONS
///////////////

/**
 * Resize text if it's too long
 * @param {string} text
 * @param {number} resize maximum size
 * @returns {string} the resized text
 */
function resize_text(text, resize)
{
    if (!text || resize < 1 || typeof(text) != 'string')
        return text;

    let len = text.length;
    if (Upper(text) == text)
        len *= 3/2;

    if (len > resize)
        text = `<span style="font-size:80%">${text}</span>`;
    return text;
}

/**
 * Set the text of a node and update its data-t
 * @param {string|Node} node CSS selector or node
 * @param {string} text
 */
function set_text(node, text) {
    Attrs(node, {'data-t': text});
    TEXT(node, translate_expression(text));
}

/**
 * Translate a text, return null if not found
 * @param {string} text
 * @returns {string|null} translated text
 */
function translate(text) {
    if (DEV.translate)
        TRANSLATES[text] = '';

    if (Y.language == 'eng')
        return text.includes('{')? null: text.split('~')[0];

    // mode
    if (!translates)
        return text;
    let result = translates[text];
    if (result)
        return result;

    let lower = Lower(text);
    if (lower == text)
        return null;

    result = translates[lower];
    if (!result)
        return null;

    // MODE
    if (text == Upper(text))
        return Upper(result);

    // Mode
    if (text[0] == Upper(text[0]))
        return Title(result);

    return null;
}

/**
 * Translate a text, defaults to itself
 * @param {string} text
 * @returns {string|null} translated text
 */
function translate_default(text) {
    return translate(text) || text;
}

/**
 * Translate an expression
 * @param {string} text
 * @returns {string} translated text
 */
function translate_expression(text) {
    if (!text)
        return '';

    // 1) try a direct translation
    let result = translate(text);
    if (result)
        text = result;
    // 2) translate {...}
    else if (text.includes('{'))
        text = text.replace(/{(.*?)}/g, (_match, p1) => translate_default(p1));

    // 3) translate [...]
    if (text.includes('['))
        text = text.replace(/\[(.*?)\]/g, (_match, p1) => TRANSLATE_SPECIALS[p1] || p1);
    return text;
}

/**
 * Translate a node
 * - resolve all data-t, data-t2=target, data-tr=resize
 * @param {string|Node=} parent CSS selector or node
 */
function translate_node(parent) {
    E('[data-t]', node => {
        let tag = node.tagName,
            target = node.dataset.t2,
            text = node.dataset.t,
            translated = translate_expression(text);

        if (!target)
            if (tag == 'INPUT')
                target = 'value';
            else if (tag == 'IMG')
                target = 'title';

        if (target)
            node.setAttribute(target, translated);
        else {
            let resize = node.dataset.tr;
            if (resize)
                translated = resize_text(translated, parseInt(resize));
            TEXT(node, translated);
        }
    }, _(parent));
}

// NODES
////////

/**
 * Create a canvas for a texture
 * @param {number} width
 * @param {number=} height
 * @returns {Object}
 */
function create_canvas(width, height) {
    let canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height || width;
    return ctx;
}

/**
 * Fill a combo filter
 * @param {string} letter, ex: m=mode, v=view ... or a selector
 * @param {string[]} values list of values for the combo, default to [DEFAULTS[letter]]
 * @param {string=} select the value to be selected, default to Y[letter]
 * @param {Object=} dico used to name the values, ex: 01 => cheater
 * @param {boolean=} no_translate don't translate the options
 * @returns {string} the selected value
 */
function fill_combo(letter, values, select, dico, no_translate)
{
    dico = Undefined(dico, {});

    if (values == null)
        values = [DEFAULTS[letter]];
    if (select == null)
        select = Y[letter];

    let found = 'all',
        group = false,
        lines = [];

    for (let value_ of values) {
        let selected,
            items = (value_ + '').split('='),
            text = items.slice(-1)[0],
            value = Lower(items.slice(-2)[0]);

        if (value.slice(0, 2) == '* ') {
            if (group) lines.push('</optgroup>');
            group = true;
            lines.push(`<optgroup data-t="${text.slice(2)}" data-t2="label">`);
            continue;
        }

        if (select == value.split('|')[0]) {
            selected = ' selected="selected"';
            found = value;
        }
        else
            selected = '';

        // 'name of event|extra|info' => 'name of event'
        text = text.split('|')[0];
        // rename using dico or custom function
        if (items.length < 2) {
            text = dico[text] || text;
            if (virtual_rename_option)
                text = virtual_rename_option(value, text);
        }

        // parent:child => {parent}: {child}
        let splits = text.split(':');
        if (splits.length > 1)
            text = `{${splits[0]}}: {${splits[1]}}`;

        if (no_translate)
            lines.push(`<option value="${value}"${selected}>${text}</option>`);
        else
            lines.push(`<option value="${value}"${selected} data-t="${text}"></option>`);
    }
    if (group)
        lines.push('</optgroup>');

    // set the HTML: 1 letter => #co+letter, otherwise letter is a selector
    if (letter) {
        let sel = letter_selector(letter);
        HTML(sel, lines.join(''));
        translate_node(sel);
    }
    return found.split('|')[0];
}

/**
 * Get the selector for a single letter
 * + letter is a selector if it has more than 1 letter
 * @param {string} letter
 * @returns {string} CSS selector
 */
function letter_selector(letter) {
    if (letter.length == 1)
        letter = `#co${letter}`;
    return letter;
}

/**
 * Set a combo value
 * @param {string} letter combo letter: g, m, t, c, f + special cases: n, o, s
 * @param {string} value
 * @param {boolean|string=} [save=true] save in memory, if string: use this for saving, ex: #classes => class
 */
function set_combo_value(letter, value, save=true) {
    // n, o, s special cases
    if (virtual_set_combo_special && !virtual_set_combo_special(letter, value)) {
        let combo = _(letter_selector(letter)),
            index = 0;
        if (!combo)
            return;

        for (let option of combo.options) {
            if (option.value.split('|')[0] == value) {
                combo.selectedIndex = index;
                break;
            }
            index ++;
        }
    }

    // save in memory
    if (save) {
        if (typeof(save) == 'string')
            letter = save;

        if (Y[letter] !== value) {
            Y[letter] = value;
            // filter changed => go back to page 1
            Y.skip = 0;
        }
        save_storage(letter, value);
    }
}

/**
 * Resolve the SVG
 * @param {Node=} parent
 */
function update_svg(parent) {
    E('i[data-svg]', node => {
        let name = node.dataset.svg,
            image = ICONS[name.split(' ')[0]];
        if (image) {
            // VB=viewBox=; PFC=path fill="currentColor"
            image = image.replace('VB=', 'viewBox=').replace('PFC', 'path fill="currentColor"');
            image = `<svg class="svg ${name}" xmlns="${NAMESPACE_SVG}" ${image}</svg>`;
            HTML(node, image);
            delete node.dataset.svg;
        }
    }, parent);
}

/**
 * Update the theme
 * @param {string[]=} themes if null, will use Y.theme
 * @param {function=} callback
 * @param {number=} version CSS version, use Now() to force reload
 */
function update_theme(themes, callback, version=15) {
    let parent = Id('extra-style');
    if (!parent)
        return;
    if (!themes)
        themes = [Y.theme];

    // default theme is skipped because it's already loaded
    if (themes[0] == THEMES[0])
        themes = themes.slice(1);

    let children = A('link', parent),
        links = themes.map(theme => `css/${theme}.css?v=${version}`),
        num_child = children.length,
        num_theme = themes.length,
        min = Min(num_child, num_theme);

    // 1) replace existing links
    for (let i = 0; i < min; i ++) {
        let child = children[i],
            base_href = child.href.split('/').slice(-1)[0].split('.')[0],
            theme = themes[i];

        if (base_href != theme)
            child.setAttribute('href', links[i]);
    }

    // 2) remove extra links
    if (num_child > num_theme) {
        for (let i = num_theme; i < num_child; i ++)
            children[i].removeAttribute('href');
    }
    // 3) add extra links
    else if (num_child < num_theme) {
        for (let i = num_child; i < num_theme; i ++) {
            let child = CreateNode('link', null, {href: links[i], rel: 'stylesheet'});
            parent.appendChild(child);
        }
    }

    // post-process
    update_svg();
    if (callback)
        callback();
}

// BROWSER
//////////

/**
 * Check the query hash/string
 * @param {boolean=} no_special
 */
function check_hash(no_special) {
    let string = QueryString({key: 'hash'});
    Assign(Y, ...Keys(string).map(key => ({[key]: (string[key] == 'undefined')? undefined: string[key]})));
    sanitise_data();

    if (!no_special && virtual_check_hash_special)
        virtual_check_hash_special();
}

/**
 * Detect the device
 */
function detect_device() {
    let agent = navigator.userAgent || navigator.vendor || window.opera,
        mobile = false,
        os = '?';

    if (/windows phone/i.test(agent))
        os = 'windows';
    else if (/android/i.test(agent))
        os = 'android';
    else if (/iPad|iPhone|iPod/.test(agent) && !window.MSStream)
        os = 'ios';

    if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(agent))
        mobile = true;

    device.os = os;
    device.mobile = mobile;
}

/**
 * Guess the browser language
 */
function guess_browser_language() {
    let indices = Assign({}, ...Keys(LANGUAGES).map(lan => ({[lan.slice(0, 2)]: lan}))),
        languages = [...[navigator.language], ...navigator.languages];
    Assign(indices, LANGUAGES_23);
    for (let lan of languages) {
        lan = lan.split('-')[0];
        let index = indices[lan];
        if (index) {
            Y.language = index;
            break;
        }
    }
}

/**
 * Check if the browser is in full screen mode
 * @returns {Node}
 */
function is_fullscreen() {
    let full = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    full_target = full? Id('body'): null;
    return full;
}

/**
 * Load default settings
 */
function load_defaults() {
    Keys(DEFAULTS).forEach(key => {
        let value,
            def = DEFAULTS[key];
        if (Number.isInteger(def) || typeof(def) == 'boolean')
            value = get_int(key, def);
        else if (Number.isFinite(def))
            value = get_float(key, def);
        else if (typeof(def) == 'object')
            value = get_object(key, def);
        else
            value = get_string(key, def);
        Y[key] = value;
    });

    // use browser language
    if (!Y.language)
        guess_browser_language();
}

/**
 * Push history state if it changed
 * @param {Object} query
 * @param {boolean=} replace replace the state instead of pushing it
 * @param {string=} query_key
 * @param {string=} go change URL location
 * @returns {Object|boolean} dictionary of changes, or null if empty
 */
function push_state(query, replace, query_key='hash', go=null) {
    query = query || {};
    let changes = [],
        state_keys = STATE_KEYS[Y.x] || STATE_KEYS._ || [],
        new_state = Assign({}, ...state_keys.map(x => ({[x]: Undefined(query[x], Y[x])}))),
        state = history.state,
        url = QueryString({key: query_key, replace: new_state, string: true});

    // state didn't change => return
    if (state) {
        changes = state_keys.filter(key => (new_state[key] !== state[key]));
        if (!changes.length)
            return null;
    }

    if (go)
        location[go] = url;
    else {
        url = `${QUERY_KEYS[query_key]}${url}`;
        let exist = location[query_key];
        if (exist == url)
            return;
        if (replace)
            history.replaceState(new_state, '', url);
        else
            history.pushState(new_state, '', url);
    }

    return Assign({}, ...changes.map(change => ({[change]: 1})));
}

/**
 * Make sure there is no garbage data
 */
function sanitise_data() {
    // convert string to number
    Keys(DEFAULTS).forEach(key => {
        let def = DEFAULTS[key],
            value = Y[key];
        if (Number.isInteger(def) && !Number.isInteger(value))
            Y[key] = parseInt(value) || def;
        else if (Number.isFinite(def) && !Number.isFinite(value))
            Y[key] = parseFloat(value) || def;
    });

    if (virtual_sanitise_data_special)
        virtual_sanitise_data_special();
}

/**
 * Change mouse cursor
 * @param {string} cursor
 */
function set_cursor(cursor='') {
    if (!device.mobile)
        document.body.style.cursor = cursor;
}

/**
 * Toggle full screen mode
 * @param {function} callback
 */
function toggle_fullscreen(callback) {
    let full = is_fullscreen();
    if (is_fullscreen()) {
        let exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
        if (exit)
            exit.call(document);
    }
    else {
        let body = document.body,
            enter = body.requestFullscreen || body.webkitRequestFullScreen || body.mozRequestFullScreen;
        if (enter)
            enter.call(body);
    }

    if (callback)
        callback(full);
}

// TOUCH
////////

/**
 * Add a touch move
 * @param {Object} change
 * @param {number} stamp
 * @param {number=} ratio_x
 * @param {number=} ratio_y
 * @returns {number[]} deltas
 */
function add_move(change, stamp, ratio_x=1, ratio_y=1) {
    if (!drag)
        return [0, 0];
    let dx = (change.x - drag[0].x) * ratio_x,
        dy = (change.y - drag[0].y) * ratio_y;
    touch_moves.push([dx, dy, (stamp - drag[1])]);
    return [dx, dy];
}

/**
 * We cannot click just after a touch drop, as that would cause misclick events
 * @returns {boolean}
 */
function cannot_click() {
    return (Now(true) < touch_done + TIMEOUT_touch);
}

/**
 * Finished touching which means we cannot click for a bit
 */
function done_touch() {
    touch_done = Now(true);
}

/**
 * Get the parent area of a node
 * @param {Node} node
 * @returns {Node}
 */
function get_area(node) {
    return Parent(node, {class_: 'area'});
}

/**
 * Get the changed touches + stamp
 * @param {Event} e
 * @returns {*[]} [changed_touches, stamp]
 */
function get_changed_touches(e) {
    let touches = e.changedTouches || e.touches;
    if (touches)
        touches = [...touches].map(touch => ({x: touch.clientX, y: touch.clientY}));
    else
        touches = [{x: e.clientX, y: e.clientY}];
    return [touches, e.timeStamp];
}

/**
 * Render the inertial scrolling
 */
function render_scroll() {
    if (!Y.scroll_inertia)
        return;

    let now = Now(true),
        delta = Min(33, (now - touch_now) * 1000),
        ratio = Y.scroll_inertia;

    touch_scroll.x -= touch_speed.x * delta;
    touch_scroll.y -= touch_speed.y * delta;
    if (full_target) {
        full_scroll.x -= touch_speed.x * delta;
        full_scroll.y -= touch_speed.y * delta;
    }
    set_scroll();

    if (Abs(touch_speed.x) > 0.03 || Abs(touch_speed.y) > 0.03) {
        touch_speed.x *= ratio;
        touch_speed.y *= ratio;
        requestAnimationFrame(render_scroll);
    }
    touch_now = now;
}

/**
 * Adjust the scrolling to the nearest anchor (if near enough)
 * - can be used to scroll to a specific target
 * - can be used after mouse wheel
 * @param {string} target
 * @param {number=} max_delta
 * @param {number=} depth
 */
function scroll_adjust(target, max_delta, depth=0) {
    if (max_delta == undefined)
        max_delta = Y.wheel_adjust;

    let keys = target? [target]: Keys(ANCHORS),
        max_allowed = 100,
        window_height = window.innerHeight,
        y = ScrollDocument(),
        y_old = y;

    if ((!y || y >= document.scrollingElement.offsetHeight - window_height) && !target)
        return;

    // 1) gather anchor data
    let deltas = keys.map(key => {
        let [flag, gap, priority] = ANCHORS[key] || [0, 0, 0],
            nodes = From(A(key)).filter(child => Visible(child));
        if (!nodes.length)
            return;

        let delta1, delta2,
            rect = nodes[0].getBoundingClientRect(),
            bottom = rect.bottom + y - gap - window_height,
            top = rect.top + y - gap;

        if (flag & 1) {
            delta1 = top - y;
            if (Abs(delta1) > max_allowed)
                return;
        }
        if (flag & 2) {
            delta2 = bottom - y;
            if (Abs(delta2) > max_allowed)
                return;
        }

        return [priority, key, delta1, delta2, top, bottom, gap];
    }).filter(vector => vector).sort((a, b) => {
        if (a[0] != b[0])
            return b[0] - a[0];
        return (b[2] || b[3]) - (a[2] || a[3]);
    });

    // 2) no anchors found => scroll to the target if any
    if (!deltas.length) {
        if (target) {
            y = _(target).getBoundingClientRect().top + y;
            ScrollDocument(y, true);
        }
        return;
    }

    // 3) get the closest matches
    let offset, y1, y2, y3,
        diff = max_delta,
        diff3 = diff;
    for (let [priority, key, delta1, delta2, top, bottom] of deltas) {
        if (DEV.ui)
            LS(`${priority} : ${key} : ${delta1} : ${delta2} : ${top} : ${bottom}`);
        if (delta2 != undefined && Abs(delta2) < max_delta) {
            y2 = bottom;
            offset = -delta2;
        }
        if (delta1 != undefined) {
            if (offset) {
                delta1 += offset;
                if (delta1 < 0) {
                    if (delta1 > -max_delta && Abs(delta1) < Abs(diff3)) {
                        diff3 = delta1;
                        y3 = top;
                    }
                    continue;
                }
            }
            if (Abs(delta1) < Abs(diff)) {
                diff = delta1;
                y1 = top;
            }
        }
    }

    // 4) combine the best matches
    let combined = 0;
    if (y1 == undefined && y3 != undefined)
        y = y3;
    else {
        let ys = [y1, y2].filter(value => value != undefined);
        combined = ys.length;
        if (!combined)
            return;
        y = ys.reduce((a, b) => a + b) / ys.length;
    }
    ScrollDocument(y, true);

    // 5) adjust again?
    if (!target && depth < 1 && combined < 2) {
        let new_delta = max_delta - Abs(y - y_old);
        if (new_delta > 0)
            add_timeout('adjust', () => {scroll_adjust(target, new_delta, depth + 1);}, TIMEOUT_adjust);
    }
}

/**
 * Set the scroll
 */
function set_scroll() {
    let node = drag_target || scroll_target;

    if (node) {
        // horizontal
        if (drag_scroll & 1) {
            node.scrollLeft = touch_scroll.x;
            touch_scroll.x = node.scrollLeft;
        }
        // vertical
        if (drag_scroll & 2) {
            ScrollDocument(touch_scroll.y);
            touch_scroll.y = ScrollDocument();
        }
    }

    if (full_target) {
        full_scroll.x = Clamp(full_scroll.x, 0, full_target.clientWidth - window.innerWidth);
        full_scroll.y = Clamp(full_scroll.y, 0, full_target.clientHeight - window.innerHeight);
        Style(full_target, `transform:translate(${-full_scroll.x}px,${-full_scroll.y}px)`);
    }
}

/**
 * Stop dragging
 */
function stop_drag() {
    drag = null;
    drag_moved = false;
    drag_scroll = 3;
    drag_target = null;
}

/**
 * Handle a touch/mouse event
 * @param {Event} e
 * @returns {Object[]}
 */
function touch_event(e) {
    let [changes, stamp] = get_changed_touches(e),
        change = changes[0],
        error = -1,
        length = changes.length;

    // multiple inputs => keep the one closer to the previous input
    if (length > 1) {
        if (drag) {
            let best_x, best_y;
            for (let touch of changes) {
                let dx = (touch.x - touch_last.x),
                    dy = (touch.y - touch_last.y),
                    delta = dx * dx + dy * dy;

                if (error < 0 || delta < error) {
                    error = delta;
                    best_x = touch.x;
                    best_y = touch.y;
                }
            }
            if (error >= 0)
                change = {x: best_x, y: best_y};
        }
        else {
            let total = [0, 0];
            for (let touch of changes) {
                total[0] += touch.x;
                total[1] += touch.y;
            }
            change = {x: total[0] / length, y: total[1] / length};
        }
    }
    else if (drag) {
        let dx = (change.x - touch_last.x),
            dy = (change.y - touch_last.y);
        error = dx * dx + dy * dy;
    }

    return [change, stamp, error];
}

/**
 * Handle a touch event
 * - supports full screen scroll
 * @param {Event} e
 * @param {boolean=} full full screen scrolling
 */
function touch_handle(e, full) {
    if (full == undefined)
        full = is_fullscreen();

    let buttons = e.buttons,
        [change, stamp] = touch_event(e),
        target = e.target,
        type = e.type,
        type5 = type.slice(0, 5);

    if (TOUCH_STARTS[type]) {
        let old_target = drag_target;
        stop_drag();
        if (type5 == 'mouse' && buttons != 1)
            return;
        // input => skip
        if (['INPUT', 'SELECT'].includes(target.tagName))
            return;
        // can only acquire a new target with a click
        if (type == 'mouseenter' && !old_target)
            return;

        clear_timeout('touch_end');

        drag_target = Parent(target, {class_: 'scroller', self: true, tag: 'div'});
        if (!full_target) {
            // maybe the object is already fully visible?
            // TODO: limit x and y directions individually
            let child = drag_target.firstElementChild,
                child_height = child.clientHeight,
                child_width = child.clientWidth;

            if (child_height <= drag_target.clientHeight && child_width <= drag_target.clientWidth)
                return;
        }

        drag = [change, stamp];
        drag_type = type5;
        touch_last = change;
        touch_moves = [];
        touch_now = Now(true);
        touch_speed = {x: 0, y: 0};
        touch_start = touch_now;

        touch_scroll = {
            x: drag_target? drag_target.scrollLeft: 0,
            y: ScrollDocument(),
        };
    }
    else if (TOUCH_MOVES[type]) {
        if (!drag)
            return;
        // reset needed when we move the mouse outside the window, then come back
        if (type == 'mousemove' && !buttons) {
            stop_drag();
            return;
        }

        drag_moved = true;
        let [dx, dy] = add_move(change, stamp);
        touch_last = change;

        touch_scroll.x -= dx;
        touch_scroll.y -= dy;
        if (full_target) {
            full_scroll.x -= dx;
            full_scroll.y -= dy;
        }
        set_scroll();

        drag = [change, stamp];

        if (e.cancelable || type5 != 'touch')
            e.preventDefault();
    }
    else if (TOUCH_ENDS[type]) {
        if (!drag || !drag_moved)
            return;

        add_move(change, stamp);

        // inertia during the last 100ms
        let sumx = 0,
            sumy = 0,
            time = 0;
        for (let [dx, dy, ms] of touch_moves.reverse()) {
            sumx += dx;
            sumy += dy;
            time += ms;
            if (time >= 100)
                break;
        }

        done_touch();
        touch_now = touch_done;
        let absx = Abs(sumx),
            absy = Abs(sumy),
            elapsed = touch_now - touch_start;

        // some movement => scroll
        if (absx > 1 || absy > 1) {
            scroll_target = drag_target;
            touch_speed = {x: sumx / time, y: sumy / time};
            requestAnimationFrame(render_scroll);
        }
        // big movement or average duration => prevent click
        if (type != 'mouseleave') {
            drag = null;
            if (absx > 2 || absy > 2 || (elapsed > 0.3 && elapsed < 1))
                add_timeout('touch_end', stop_drag, 10);
            else
                stop_drag();
        }
    }

    e.stopPropagation();
}

/**
 * Handle a wheel event
 * @param {Event} e
 * @param {boolean=} full full screen scrolling
 */
function wheel_event(e, full) {
    if (full_target) {
        full_scroll.x -= e.wheelDeltaX / 3;
        full_scroll.y -= e.wheelDeltaY / 3;
    }
    if (!full) {
        scroll_target = window;
        touch_scroll.y -= e.wheelDeltaY / 3;
    }

    set_scroll();
    e.preventDefault();
}

// UI
/////

/**
 * Create an array of pages
 * @param {number} num_page
 * @param {number} page
 * @param {number} extra
 * @returns {number[]}
 */
function create_page_array(num_page, page, extra) {
    if (num_page < 2)
        return [2];

    let array = new Array(num_page),
        left = extra + (page <= 1 || page >= num_page - 2) * 1;

    array.fill(0);
    array[1] = 1;
    array[num_page - 2] = 1;
    array[0] = 2;
    array[num_page - 1] = 2;
    array[page]= 2;

    let off = 1;
    for (let i = 0; i < num_page && left > 0; i ++) {
        let id = page + off;
        if (id >= 0 && id < num_page && !array[id]) {
            array[id] = 2;
            left --;
        }

        off = -off;
        if (off > 0)
            off ++;
    }

    if (array[2])
        array[1] = 2;
    if (array[num_page - 3])
        array[num_page - 2] = 2;
    return array;
}

// API
//////

/**
 * Get translations
 */
function api_translate_get() {
    // 1) cached?
    if (Y.language == 'eng' || (translates._lan == Y.language && Now() < (api_times.translate || 0) + TIMEOUT_translate)) {
        translate_node('body');
        return;
    }

    // 2) call the API
    Resource(`translate/${Y.language}.json`, (code, data) => {
        if (code != 200)
            return;
        translates = data;
        api_times.translate = Now(true);
        save_storage('trans', translates);
        save_storage('times', api_times);
        translate_node('body');
    });
}
