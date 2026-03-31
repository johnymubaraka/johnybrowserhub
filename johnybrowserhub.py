import sys
import os
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QStackedWidget, QGridLayout
)
from PyQt5.QtWebEngineWidgets import QWebEngineView
from PyQt5.QtCore import QUrl, Qt, QSize
from PyQt5.QtGui import QIcon, QFont

# ---------------- CONFIG ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ICON_DIR = os.path.join(BASE_DIR, "icons")

BROWSERS = {
    "Chrome": {
        "icon": "chrome.png",
        "download": "https://www.google.com/chrome/",
        "open": "https://www.google.com"
    },
    "Firefox": {
        "icon": "firefox.png",
        "download": "https://www.mozilla.org/firefox/",
        "open": "https://www.google.com"
    },
    "Edge": {
        "icon": "edge.png",
        "download": "https://www.microsoft.com/edge",
        "open": "https://www.google.com"
    },
    "Vivaldi": {
        "icon": "vivaldi.png",
        "download": "https://vivaldi.com/download/",
        "open": "https://www.google.com"
    },
    "Tor": {
        "icon": "tor.png",
        "download": "https://www.torproject.org/download/",
        "open": "https://www.google.com"
    },
    "TikTok": {
        "icon": "tiktok.png",
        "download": "https://www.tiktok.com/download",
        "open": "https://www.tiktok.com"
    }
}

# ---------------- MAIN APP ----------------
class JohnyBrowserHub(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("JohnyBrowserHub")
        self.resize(1100, 700)

        self.stack = QStackedWidget()
        self.setCentralWidget(self.stack)

        self.home_page = self.create_home_page()
        self.browser_page = self.create_browser_page()

        self.stack.addWidget(self.home_page)
        self.stack.addWidget(self.browser_page)

    # -------- HOME PAGE --------
    def create_home_page(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)

        title = QLabel("JohnyBrowserHub")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont("Arial", 26, QFont.Bold))
        layout.addWidget(title)

        subtitle = QLabel("Choose a browser or app")
        subtitle.setAlignment(Qt.AlignCenter)
        layout.addWidget(subtitle)

        grid = QGridLayout()
        row = col = 0

        for name, data in BROWSERS.items():
            vbox = QVBoxLayout()

            btn = QPushButton()
            btn.setIcon(QIcon(os.path.join(ICON_DIR, data["icon"])))
            btn.setIconSize(QSize(64, 64))
            btn.setFixedSize(90, 90)
            btn.clicked.connect(lambda checked=False, url=data["open"]: self.open_page(url))

            label = QLabel(name)
            label.setAlignment(Qt.AlignCenter)

            dwn = QPushButton("Download")
            dwn.setFixedHeight(22)
            dwn.clicked.connect(lambda checked=False, url=data["download"]: self.open_page(url))

            vbox.addWidget(btn, alignment=Qt.AlignCenter)
            vbox.addWidget(label)
            vbox.addWidget(dwn)

            box = QWidget()
            box.setLayout(vbox)
            grid.addWidget(box, row, col)

            col += 1
            if col >= 3:
                col = 0
                row += 1

        layout.addLayout(grid)
        layout.addStretch()
        return widget

    # -------- BROWSER PAGE --------
    def create_browser_page(self):
        widget = QWidget()
        layout = QVBoxLayout(widget)

        top_bar = QHBoxLayout()
        home_btn = QPushButton("⬅ Home")
        home_btn.clicked.connect(self.go_home)

        top_bar.addWidget(home_btn)
        top_bar.addStretch()
        layout.addLayout(top_bar)

        self.web = QWebEngineView()
        self.web.load(QUrl("https://www.google.com"))
        layout.addWidget(self.web)

        return widget

    # -------- FUNCTIONS --------
    def open_page(self, url):
        self.web.load(QUrl(url))
        self.stack.setCurrentIndex(1)

    def go_home(self):
        self.stack.setCurrentIndex(0)


# ---------------- RUN ----------------
if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = JohnyBrowserHub()
    window.show()
    sys.exit(app.exec_())
