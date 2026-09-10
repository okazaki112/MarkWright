// 桌面端：避免 release 模式弹出额外控制台
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    markwright_lib::run()
}
