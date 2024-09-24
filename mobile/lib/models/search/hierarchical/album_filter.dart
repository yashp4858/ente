import "package:flutter/material.dart";
import "package:photos/models/file/file.dart";
import "package:photos/models/search/hierarchical/hierarchical_search_filter.dart";

class AlbumFilter extends HierarchicalSearchFilter {
  final int collectionID;
  final String albumName;

  ///Number of files in the gallery that are from [collectionID]
  final int occurrence;
  final Set<int> matchedUploadedIDs = {};

  AlbumFilter({
    required this.collectionID,
    required this.albumName,
    required this.occurrence,
  });

  @override
  String name() {
    return albumName;
  }

  @override
  IconData icon() {
    return Icons.photo_library_outlined;
  }

  @override
  int relevance() {
    return occurrence;
  }

  @override
  bool isMatch(EnteFile file) {
    return file.collectionID == collectionID;
  }

  @override
  Set<int> getMatchedUploadedIDs() {
    return matchedUploadedIDs;
  }
}
